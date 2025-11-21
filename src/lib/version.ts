/**
 * 版本检测和管理工具
 * 版本号格式: YYYYMMDDHHMMSS (年月日时分秒)
 */

// 版本常量
const CURRENT_SEMANTIC_VERSION = '0.6.0';
export const CURRENT_VERSION = CURRENT_SEMANTIC_VERSION;

export interface VersionInfo {
  version: string; // package.json 版本 (如 "0.2.0")
  timestamp: string; // 时间戳版本 (如 "20251005140531")
  buildTime: Date; // 构建时间
  isLatest: boolean; // 是否为最新版本
  updateAvailable: boolean; // 是否有更新可用
  displayVersion: string; // 显示版本 (如 "v0.2.0")
}

export interface RemoteVersionInfo {
  version: string;
  timestamp: string;
  releaseNotes?: string[];
  downloadUrl?: string;
}

/**
 * 解析时间戳版本号
 */
export function parseVersionTimestamp(timestamp: string): Date | null {
  if (!/^\d{14}$/.test(timestamp)) {
    return null;
  }

  const year = parseInt(timestamp.slice(0, 4));
  const month = parseInt(timestamp.slice(4, 6)) - 1; // JS 月份从0开始
  const day = parseInt(timestamp.slice(6, 8));
  const hour = parseInt(timestamp.slice(8, 10));
  const minute = parseInt(timestamp.slice(10, 12));
  const second = parseInt(timestamp.slice(12, 14));

  const date = new Date(year, month, day, hour, minute, second);

  // 验证日期是否有效
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * 比较两个版本时间戳
 * @param current 当前版本时间戳
 * @param remote 远程版本时间戳
 * @returns 1: 当前版本更新, 0: 版本相同, -1: 远程版本更新
 */
export function compareVersions(current: string, remote: string): number {
  const currentNum = parseInt(current);
  const remoteNum = parseInt(remote);

  if (currentNum > remoteNum) return 1;
  if (currentNum < remoteNum) return -1;
  return 0;
}

/**
 * 格式化版本时间戳为可读格式
 */
export function formatVersionTimestamp(timestamp: string): string {
  const date = parseVersionTimestamp(timestamp);
  if (!date) return timestamp;

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * 生成当前时间戳版本号
 */
export function generateVersionTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');

  return `${year}${month}${day}${hour}${minute}${second}`;
}

/**
 * 获取当前版本信息
 */
/**
 * 获取当前版本信息（基于时间戳）
 */
export async function getCurrentVersionInfo(): Promise<VersionInfo> {
  try {
    // 从 VERSION.txt 获取时间戳版本
    const response = await fetch('/VERSION.txt');
    const timestamp = (await response.text()).trim();

    const buildTime = parseVersionTimestamp(timestamp) || new Date();

    return {
      version: CURRENT_VERSION,
      timestamp,
      buildTime,
      isLatest: true, // 将在 checkForUpdates 中更新
      updateAvailable: false, // 将在 checkForUpdates 中更新
      displayVersion: `v${CURRENT_VERSION}`,
    };
  } catch (error) {
    // 降级处理：使用 VERSION.txt 的默认值
    const timestamp = '20251006163200';
    return {
      version: CURRENT_VERSION,
      timestamp,
      buildTime: parseVersionTimestamp(timestamp) || new Date(),
      isLatest: true,
      updateAvailable: false,
      displayVersion: `v${CURRENT_VERSION}`,
    };
  }
}

/**
 * 从远程获取版本时间戳
 */
async function fetchRemoteVersion(): Promise<string | null> {
  try {
    const repoUrl =
      'https://raw.githubusercontent.com/Decohererk/DecoTV/main/VERSION.txt';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

    const response = await fetch(repoUrl, {
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const timestamp = (await response.text()).trim();

    // 验证时间戳格式
    if (!/^\d{14}$/.test(timestamp)) {
      return null;
    }

    return timestamp;
  } catch (error) {
    // 网络错误或超时，静默处理
    return null;
  }
}

/**
 * 从远程获取语义版本号
 */
async function fetchRemoteSemanticVersion(): Promise<string | null> {
  try {
    const repoUrl =
      'https://raw.githubusercontent.com/Decohererk/DecoTV/main/package.json';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

    const response = await fetch(repoUrl, {
      signal: controller.signal,
      cache: 'no-cache',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const packageJson = await response.json();
    return packageJson.version || null;
  } catch (error) {
    // 网络错误或超时，静默处理
    return null;
  }
}

/**
 * 检查是否有新版本可用（基于时间戳比较）
 */
export async function checkForUpdates(currentTimestamp: string): Promise<{
  hasUpdate: boolean;
  remoteVersion?: RemoteVersionInfo;
}> {
  try {
    // 同时获取远程时间戳和语义版本号
    const [remoteTimestamp, remoteSemanticVersion] = await Promise.all([
      fetchRemoteVersion(),
      fetchRemoteSemanticVersion(),
    ]);

    if (!remoteTimestamp) {
      return {
        hasUpdate: false,
      };
    }

    // 比较时间戳：只有远程时间戳大于当前时间戳才认为有更新
    const comparison = compareVersions(currentTimestamp, remoteTimestamp);
    const hasUpdate = comparison < 0;

    if (hasUpdate) {
      // 使用远程的语义版本号，如果获取失败则使用时间戳后6位
      // 如果远程版本号已经包含 v 前缀，就不再添加
      const displayVersion = remoteSemanticVersion
        ? remoteSemanticVersion.startsWith('v')
          ? remoteSemanticVersion
          : `v${remoteSemanticVersion}`
        : `v${CURRENT_VERSION}+${remoteTimestamp.slice(-6)}`;

      const remoteVersion: RemoteVersionInfo = {
        version: displayVersion,
        timestamp: remoteTimestamp,
        releaseNotes: [
          '发现新版本可用',
          `最新版本: ${displayVersion}`,
          `构建时间: ${formatVersionTimestamp(remoteTimestamp)}`,
          '点击前往仓库查看更新详情',
        ],
        downloadUrl: 'https://github.com/xiaojian1020/DecoTV',
      };

      return {
        hasUpdate: true,
        remoteVersion,
      };
    }

    return {
      hasUpdate: false,
    };
  } catch (error) {
    // 静默处理错误
    return {
      hasUpdate: false,
    };
  }
}

/**
 * 获取版本状态文本和颜色
 */
export function getVersionStatusInfo(versionInfo: VersionInfo) {
  if (versionInfo.updateAvailable) {
    return {
      text: '有新版本可用',
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      icon: '🔄',
    };
  }

  return {
    text: '当前已是最新版本',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800',
    icon: '✅',
  };
}

// CURRENT_VERSION 已在文件顶部导出
