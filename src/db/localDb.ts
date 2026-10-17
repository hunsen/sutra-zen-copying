// ============================================================================
// 「静心抄经」原生 IndexedDB 离线持久化数据层
// src/db/localDb.ts
// 100% 离线可用，零第三方依赖，支持毫秒级笔迹自动持久化与历史功德簿管理
// ============================================================================

import {
  CopyingSession,
  WrittenCharRecord,
  BrushStroke,
  SutraDocument,
  SessionSummary,
} from '../types/sutra';
import { BUILT_IN_SUTRAS, getSutraById } from '../data/builtInSutras';

const DB_NAME = 'sutra_zen_copying_v1';
const DB_VERSION = 1;

const STORES = {
  SESSIONS: 'sessions',
  CUSTOM_SUTRAS: 'custom_sutras',
  APP_SETTINGS: 'app_settings',
} as const;

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * 检查当前环境是否支持 IndexedDB
 */
export function isIndexedDBSupported(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null;
}

/**
 * 初始化并获取 IndexedDB 数据库连接实例（单例复用连接池）
 */
export function openLocalDb(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (dbPromise) {
    return dbPromise;
  }

  if (!isIndexedDBSupported()) {
    return Promise.reject(new Error('当前运行环境不支持 IndexedDB 本地数据库'));
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 1. 抄经会话表（存储完整矢量笔画与完成状态）
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.SESSIONS, {
          keyPath: 'sessionId',
        });
        sessionStore.createIndex('sutraId', 'sutraId', { unique: false });
        sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
        sessionStore.createIndex('lastActiveAt', 'lastActiveAt', { unique: false });
        sessionStore.createIndex('completedAt', 'completedAt', { unique: false });
      }

      // 2. 自定义经文帖表（存储用户自建字帖）
      if (!db.objectStoreNames.contains(STORES.CUSTOM_SUTRAS)) {
        const customStore = db.createObjectStore(STORES.CUSTOM_SUTRAS, {
          keyPath: 'id',
        });
        customStore.createIndex('title', 'title', { unique: false });
        customStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // 3. 用户偏好与系统设置表
      if (!db.objectStoreNames.contains(STORES.APP_SETTINGS)) {
        db.createObjectStore(STORES.APP_SETTINGS, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event: Event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;

      // 监听连接异常关闭
      dbInstance.onclose = () => {
        dbInstance = null;
        dbPromise = null;
      };

      dbInstance.onerror = (err) => {
        console.error('IndexedDB 内部错误:', err);
      };

      resolve(dbInstance);
    };

    request.onerror = (event: Event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      dbPromise = null;
      reject(error || new Error('打开本地数据库失败'));
    };

    request.onblocked = () => {
      console.warn('IndexedDB 升级被阻塞，请关闭其它占用数据库的标签页');
    };
  });

  return dbPromise;
}

/**
 * 辅助函数：安全克隆对象，防止含有不能被结构化克隆的属性
 */
function safeClone<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// ============================================================================
// 会话与书写进度管理 API
// ============================================================================

/**
 * 保存或全量更新抄经会话
 */
export async function saveSession(session: CopyingSession): Promise<void> {
  const db = await openLocalDb();
  const sessionToSave: CopyingSession = {
    ...session,
    lastActiveAt: Date.now(),
  };

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORES.SESSIONS, STORES.APP_SETTINGS], 'readwrite');
    const sessionStore = tx.objectStore(STORES.SESSIONS);
    const settingsStore = tx.objectStore(STORES.APP_SETTINGS);

    sessionStore.put(safeClone(sessionToSave));
    settingsStore.put({ key: 'lastActiveSessionId', value: session.sessionId });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('保存会话失败'));
    tx.onabort = () => reject(tx.error || new Error('保存会话事务被中止'));
  });
}

/**
 * 增量保存单个字的完成记录
 * 自动累加并更新当前书写索引与最后活动时间
 */
export async function saveWrittenChar(
  sessionId: string,
  charRecord: WrittenCharRecord
): Promise<CopyingSession> {
  const db = await openLocalDb();

  return new Promise<CopyingSession>((resolve, reject) => {
    const tx = db.transaction([STORES.SESSIONS, STORES.APP_SETTINGS], 'readwrite');
    const store = tx.objectStore(STORES.SESSIONS);
    const settingsStore = tx.objectStore(STORES.APP_SETTINGS);
    const getReq = store.get(sessionId);

    getReq.onsuccess = () => {
      let session = getReq.result as CopyingSession | undefined;
      if (!session) {
        // 容错兜底：若会话尚未写入主表，自动初始化该会话实体
        session = {
          sessionId,
          sutraId: 'heart-sutra',
          paperTheme: 'xuan',
          inkType: 'black',
          writtenChars: {},
          currentIndex: charRecord.charIndex + 1,
          dedicationText: '愿以此功德，普及于一切，我等与众生，皆共成佛道。',
          sealText: '静心',
          startedAt: Date.now(),
          totalDurationSec: 0,
          lastActiveAt: Date.now(),
        };
      }

      if (!session.writtenChars) {
        session.writtenChars = {};
      }
      session.writtenChars[charRecord.charIndex] = charRecord;
      session.lastActiveAt = Date.now();

      // 如果当前位置小于或等于刚写完的字，则推进到下一字
      if (session.currentIndex <= charRecord.charIndex) {
        session.currentIndex = charRecord.charIndex + 1;
      }

      store.put(safeClone(session));
      settingsStore.put({ key: 'lastActiveSessionId', value: sessionId });
    };

    tx.oncomplete = () => {
      // 再次读取最新状态返回
      getSession(sessionId)
        .then((latest) => {
          if (latest) {
            resolve(latest);
          } else {
            reject(new Error('读取更新后会话失败'));
          }
        })
        .catch(reject);
    };

    tx.onerror = () => reject(tx.error || new Error('更新字迹记录失败'));
    tx.onabort = () => reject(tx.error || new Error('更新字迹事务被中止'));
  });
}

/**
 * 实时追加单笔矢量笔画（防止中途关机或页面误关丢失当前字的笔迹）
 */
export async function appendStrokeToCurrentChar(
  sessionId: string,
  charIndex: number,
  character: string,
  stroke: BrushStroke
): Promise<void> {
  const db = await openLocalDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORES.SESSIONS, STORES.APP_SETTINGS], 'readwrite');
    const store = tx.objectStore(STORES.SESSIONS);
    const settingsStore = tx.objectStore(STORES.APP_SETTINGS);
    const getReq = store.get(sessionId);

    getReq.onsuccess = () => {
      let session = getReq.result as CopyingSession | undefined;
      if (!session) {
        session = {
          sessionId,
          sutraId: 'heart-sutra',
          paperTheme: 'xuan',
          inkType: 'black',
          writtenChars: {},
          currentIndex: charIndex,
          dedicationText: '愿以此功德，普及于一切，我等与众生，皆共成佛道。',
          sealText: '静心',
          startedAt: Date.now(),
          totalDurationSec: 0,
          lastActiveAt: Date.now(),
        };
      }

      if (!session.writtenChars) {
        session.writtenChars = {};
      }

      const existingRecord = session.writtenChars[charIndex];
      if (existingRecord) {
        existingRecord.strokes.push(stroke);
        existingRecord.updatedAt = Date.now();
      } else {
        session.writtenChars[charIndex] = {
          charIndex,
          character,
          strokes: [stroke],
          updatedAt: Date.now(),
        };
      }

      session.lastActiveAt = Date.now();
      store.put(safeClone(session));
      settingsStore.put({ key: 'lastActiveSessionId', value: sessionId });
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('追加笔画记录失败'));
    tx.onabort = () => reject(tx.error || new Error('追加笔画事务中止'));
  });
}

/**
 * 实时同步/更新当前字的全部笔迹（用于撤销或清空重写时与本地数据库保持严格一致）
 */
export async function updateCurrentCharStrokes(
  sessionId: string,
  charIndex: number,
  character: string,
  strokes: BrushStroke[]
): Promise<void> {
  const db = await openLocalDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.SESSIONS, 'readwrite');
    const store = tx.objectStore(STORES.SESSIONS);
    const getReq = store.get(sessionId);

    getReq.onsuccess = () => {
      const session = getReq.result as CopyingSession | undefined;
      if (!session) {
        resolve();
        return;
      }

      if (!session.writtenChars) {
        session.writtenChars = {};
      }

      if (strokes.length === 0) {
        delete session.writtenChars[charIndex];
      } else {
        session.writtenChars[charIndex] = {
          charIndex,
          character,
          strokes: [...strokes],
          updatedAt: Date.now(),
        };
      }

      session.lastActiveAt = Date.now();
      store.put(safeClone(session));
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('同步笔画记录失败'));
    tx.onabort = () => reject(tx.error || new Error('同步笔画事务中止'));
  });
}

/**
 * 根据 sessionId 获取完整抄经会话
 */
export async function getSession(sessionId: string): Promise<CopyingSession | null> {
  const db = await openLocalDb();

  return new Promise<CopyingSession | null>((resolve, reject) => {
    const tx = db.transaction(STORES.SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.SESSIONS);
    const request = store.get(sessionId);

    request.onsuccess = () => {
      resolve((request.result as CopyingSession) || null);
    };
    request.onerror = () => reject(request.error || new Error('查询会话失败'));
  });
}

/**
 * 读取上次最近未完成或活动的进度会话
 * 优先读取系统记录的 lastActiveSessionId；若无则按最后活动时间倒序查找最近一条
 */
export async function getLastActiveSession(): Promise<CopyingSession | null> {
  const db = await openLocalDb();

  // 1. 尝试从偏好设置读取 lastActiveSessionId
  const lastSessionId = await getSetting<string | null>('lastActiveSessionId', null);
  if (lastSessionId) {
    const session = await getSession(lastSessionId);
    if (session) {
      return session;
    }
  }

  // 2. 备用：从 sessions 存储中按 lastActiveAt 倒序获取第一条
  return new Promise<CopyingSession | null>((resolve, reject) => {
    const tx = db.transaction(STORES.SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.SESSIONS);
    const index = store.index('lastActiveAt');
    const request = index.openCursor(null, 'prev');

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        resolve(cursor.value as CopyingSession);
      } else {
        // 如果没有 lastActiveAt 索引，直接全量读取第一条
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const list = allReq.result as CopyingSession[];
          if (list && list.length > 0) {
            list.sort((a, b) => (b.lastActiveAt ?? b.startedAt) - (a.lastActiveAt ?? a.startedAt));
            resolve(list[0]);
          } else {
            resolve(null);
          }
        };
        allReq.onerror = () => resolve(null);
      }
    };

    request.onerror = () => reject(request.error || new Error('查询最近活动会话失败'));
  });
}

/**
 * 查找指定经文最近的一条未完成会话
 *
 * @param sutraId 经文 ID
 */
export async function getUnfinishedSession(
  sutraId?: string
): Promise<CopyingSession | null> {
  const db = await openLocalDb();

  return new Promise<CopyingSession | null>((resolve, reject) => {
    const tx = db.transaction(STORES.SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.SESSIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = (request.result as CopyingSession[]) || [];
      const unfinished = list.filter((item) => {
        const notDone = !item.completedAt;
        return sutraId ? notDone && item.sutraId === sutraId : notDone;
      });

      if (unfinished.length === 0) {
        resolve(null);
        return;
      }

      // 按最后活动时间降序
      unfinished.sort(
        (a, b) => (b.lastActiveAt ?? b.startedAt) - (a.lastActiveAt ?? a.startedAt)
      );
      resolve(unfinished[0]);
    };

    request.onerror = () => reject(request.error || new Error('查询未完成会话失败'));
  });
}

/**
 * 查询历史所有抄经会话列表（按最后活动时间倒序排序）
 */
export async function listAllSessions(): Promise<CopyingSession[]> {
  const db = await openLocalDb();

  return new Promise<CopyingSession[]>((resolve, reject) => {
    const tx = db.transaction(STORES.SESSIONS, 'readonly');
    const store = tx.objectStore(STORES.SESSIONS);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = (request.result as CopyingSession[]) || [];
      list.sort((a, b) => (b.lastActiveAt ?? b.startedAt) - (a.lastActiveAt ?? a.startedAt));
      resolve(list);
    };

    request.onerror = () => reject(request.error || new Error('查询会话列表失败'));
  });
}

/**
 * 查询历史抄经记录摘要列表（用于“功德簿”展示，轻量高效）
 */
export async function listSessionSummaries(): Promise<SessionSummary[]> {
  const sessions = await listAllSessions();
  const customSutras = await getCustomSutras();

  // 构建经文 ID -> 经文标题映射
  const sutraMap = new Map<string, SutraDocument>();
  BUILT_IN_SUTRAS.forEach((s) => sutraMap.set(s.id, s));
  customSutras.forEach((s) => sutraMap.set(s.id, s));

  return sessions.map((item) => {
    const sutra = sutraMap.get(item.sutraId);
    const totalChars = sutra?.content.length ?? 0;
    const completedChars = item.writtenChars
      ? Object.values(item.writtenChars).filter((c) => (c.strokes?.length ?? 0) > 0).length
      : 0;
    const isFinished = Boolean(
      totalChars > 0 &&
        completedChars >= totalChars &&
        (Boolean(item.completedAt) || completedChars === totalChars)
    );

    return {
      sessionId: item.sessionId,
      sutraId: item.sutraId,
      sutraTitle: sutra?.title || '未知名篇',
      paperTheme: item.paperTheme,
      inkType: item.inkType,
      completedChars,
      totalChars,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      lastActiveAt: item.lastActiveAt ?? item.startedAt,
      totalDurationSec: item.totalDurationSec || 0,
      isFinished,
    };
  });
}

/**
 * 删除指定的会话记录
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await openLocalDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORES.SESSIONS, STORES.APP_SETTINGS], 'readwrite');
    const store = tx.objectStore(STORES.SESSIONS);
    const settingsStore = tx.objectStore(STORES.APP_SETTINGS);

    store.delete(sessionId);

    // 如果删掉的是当前活跃会话，清空偏好标记
    const getReq = settingsStore.get('lastActiveSessionId');
    getReq.onsuccess = () => {
      if (getReq.result && getReq.result.value === sessionId) {
        settingsStore.delete('lastActiveSessionId');
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('删除会话失败'));
    tx.onabort = () => reject(tx.error || new Error('删除会话事务中止'));
  });
}

// ============================================================================
// 自定义经文字帖存储 API
// ============================================================================

/**
 * 保存用户自定义经文帖
 */
export async function saveCustomSutra(sutra: SutraDocument): Promise<void> {
  const db = await openLocalDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOM_SUTRAS, 'readwrite');
    const store = tx.objectStore(STORES.CUSTOM_SUTRAS);
    const record: SutraDocument = {
      ...sutra,
      isCustom: true,
      createdAt: sutra.createdAt ?? Date.now(),
    };

    store.put(safeClone(record));

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('保存自定义经文失败'));
    tx.onabort = () => reject(tx.error || new Error('保存自定义经文事务中止'));
  });
}

/**
 * 获取所有用户自定义经文
 */
export async function getCustomSutras(): Promise<SutraDocument[]> {
  const db = await openLocalDb();

  return new Promise<SutraDocument[]>((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOM_SUTRAS, 'readonly');
    const store = tx.objectStore(STORES.CUSTOM_SUTRAS);
    const request = store.getAll();

    request.onsuccess = () => {
      const list = (request.result as SutraDocument[]) || [];
      list.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      resolve(list);
    };

    request.onerror = () => reject(request.error || new Error('获取自定义经文失败'));
  });
}

/**
 * 根据 ID 查询经文（支持内置与自定义）
 */
export async function findSutraById(id: string): Promise<SutraDocument | null> {
  // 1. 优先查内置经典
  const builtIn = getSutraById(id);
  if (builtIn) {
    return builtIn;
  }

  // 2. 查询自定义经典表
  const db = await openLocalDb();
  return new Promise<SutraDocument | null>((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOM_SUTRAS, 'readonly');
    const store = tx.objectStore(STORES.CUSTOM_SUTRAS);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve((request.result as SutraDocument) || null);
    };
    request.onerror = () => reject(request.error || new Error('查询经文失败'));
  });
}

/**
 * 删除用户自定义经文
 */
export async function deleteCustomSutra(id: string): Promise<void> {
  const db = await openLocalDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.CUSTOM_SUTRAS, 'readwrite');
    const store = tx.objectStore(STORES.CUSTOM_SUTRAS);
    store.delete(id);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('删除自定义经文失败'));
    tx.onabort = () => reject(tx.error || new Error('删除自定义经文事务中止'));
  });
}

// ============================================================================
// 系统偏好设置 (Key-Value)
// ============================================================================

/**
 * 获取系统设置项
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  if (!isIndexedDBSupported()) {
    return defaultValue;
  }

  const db = await openLocalDb();
  return new Promise<T>((resolve) => {
    const tx = db.transaction(STORES.APP_SETTINGS, 'readonly');
    const store = tx.objectStore(STORES.APP_SETTINGS);
    const request = store.get(key);

    request.onsuccess = () => {
      if (request.result && request.result.value !== undefined) {
        resolve(request.result.value as T);
      } else {
        resolve(defaultValue);
      }
    };
    request.onerror = () => resolve(defaultValue);
  });
}

/**
 * 保存系统设置项
 */
export async function setSetting<T>(key: string, value: T): Promise<void> {
  if (!isIndexedDBSupported()) {
    return;
  }

  const db = await openLocalDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.APP_SETTINGS, 'readwrite');
    const store = tx.objectStore(STORES.APP_SETTINGS);
    store.put({ key, value: safeClone(value) });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('保存设置失败'));
  });
}

/**
 * 清空并重置所有本地数据库记录（谨慎使用）
 */
export async function clearAllZenDatabase(): Promise<void> {
  const db = await openLocalDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [STORES.SESSIONS, STORES.CUSTOM_SUTRAS, STORES.APP_SETTINGS],
      'readwrite'
    );
    tx.objectStore(STORES.SESSIONS).clear();
    tx.objectStore(STORES.CUSTOM_SUTRAS).clear();
    tx.objectStore(STORES.APP_SETTINGS).clear();

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('清空数据库失败'));
  });
}
