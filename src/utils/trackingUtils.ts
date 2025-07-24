import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// 预编译正则表达式以提高性能
const MV_OBSERVE_REGEX = /lxCore\.mvObserve\s*\(\s*this\s*,\s*\{/;
const OBSERVE_DOM_REGEX = /observeDom\s*:\s*['"`]([^'"`]*)['"`]/;
const GET_BID_REGEX = /getBid\s*:\s*\(([^)]*)\)\s*=>\s*(`[^`]+`|'[^']+'|"[^"]+")/;
const USE_PARAMS_REGEX = /useParams\s*:\s*\(([^)]*)\)\s*=>\s*\(\s*\{([^}]+)\}\s*\)/;
const CLASS_ATTR_REGEX = /class\s*=\s*["']([^"']+)["']/g;
const ID_ATTR_REGEX = /id\s*=\s*["']([^"']+)["']/g;

/**
 * 埋点观察配置信息
 */
export interface TrackingObserveConfig {
  observeDom: string;  // 观察的DOM选择器
  getBid?: string;     // getBid 函数内容
  useParams?: string;  // useParams 函数内容
  line: number;        // 在文件中的行号
  character: number;   // 在行中的字符位置
}

/**
 * 从TypeScript文件中解析mvObserve配置
 * @param content 文件内容
 * @returns 解析出的配置数组
 */
export function parseMvObserveConfigs(content: string): TrackingObserveConfig[] {
  const configs: TrackingObserveConfig[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 使用预编译的正则表达式匹配 lxCore.mvObserve 调用
    const mvObserveMatch = line.match(MV_OBSERVE_REGEX);

    if (mvObserveMatch) {
      try {
        // 找到配置对象的开始位置
        const startIndex = mvObserveMatch.index! + mvObserveMatch[0].length - 1; // -1 因为我们要包含 {
        let braceCount = 1;
        let configContent = '';

        // 从开始位置向后查找，直到找到匹配的闭合括号
        for (let j = i; j < lines.length; j++) {
          const currentLineText = lines[j];
          let startPos = j === i ? startIndex : 0;

          for (let k = startPos; k < currentLineText.length; k++) {
            const char = currentLineText[k];
            if (char === '{') {
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0) {
                // 找到了配置对象的结束
                configContent += currentLineText.substring(startPos, k + 1);
                break;
              }
            }
          }

          if (braceCount === 0) {
            break;
          }

          configContent += currentLineText.substring(startPos) + '\n';
        }

        // 解析配置对象
        const config = parseConfigObject(configContent, i, mvObserveMatch.index!);
        if (config) {
          configs.push(config);
        }
      } catch (error) {
        console.error('Error parsing mvObserve config:', error);
      }
    }
  }

  return configs;
}

/**
 * 解析配置对象字符串
 * @param configStr 配置对象字符串
 * @param line 行号
 * @param character 字符位置
 * @returns 解析出的配置对象
 */
function parseConfigObject(configStr: string, line: number, character: number): TrackingObserveConfig | null {
  try {
    // 使用预编译的正则表达式提取 observeDom 的值
    const observeDomMatch = configStr.match(OBSERVE_DOM_REGEX);
    if (!observeDomMatch) {
      return null;
    }

    const observeDom = observeDomMatch[1];

    // 使用预编译的正则表达式提取 getBid 函数（可选）
    const getBidMatch = configStr.match(GET_BID_REGEX);
    const getBid = getBidMatch ? getBidMatch[2] : undefined;

    // 使用预编译的正则表达式提取 useParams 函数（可选）
    const useParamsMatch = configStr.match(USE_PARAMS_REGEX);
    const useParams = useParamsMatch ? useParamsMatch[2] : undefined;

    return {
      observeDom,
      getBid,
      useParams,
      line,
      character
    };
  } catch (error) {
    console.error('Error parsing config object:', error);
    return null;
  }
}

// 正则表达式缓存，避免重复创建
const regexCache = new Map<string, RegExp>();

/**
 * 获取或创建缓存的正则表达式
 */
function getCachedRegex(pattern: string, flags: string = 'g'): RegExp {
  const key = `${pattern}|${flags}`;
  let regex = regexCache.get(key);
  if (!regex) {
    regex = new RegExp(pattern, flags);
    regexCache.set(key, regex);
  }
  // 重置lastIndex以确保可重复使用
  regex.lastIndex = 0;
  return regex;
}

/**
 * 检查WXML文件中是否存在指定的选择器
 * @param wxmlContent WXML文件内容
 * @param selector CSS选择器（如 '.goods-item' 或 '#my-id'）
 * @returns 是否找到匹配的元素
 */
export function checkSelectorInWxml(wxmlContent: string, selector: string): boolean {
  if (selector.startsWith('.')) {
    // 类选择器 - 转义特殊字符
    const className = selector.substring(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `class\\s*=\\s*["']([^"']*\\b${className}\\b[^"']*)["']`;
    const classRegex = getCachedRegex(pattern);
    return classRegex.test(wxmlContent);
  } else if (selector.startsWith('#')) {
    // ID选择器 - 转义特殊字符
    const idName = selector.substring(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `id\\s*=\\s*["']\\s*${idName}\\s*["']`;
    const idRegex = getCachedRegex(pattern);
    return idRegex.test(wxmlContent);
  }

  return false;
}

/**
 * 获取对应的WXML文件路径
 * @param tsFilePath TypeScript文件路径
 * @returns WXML文件路径，如果不存在则返回null
 */
export function getCorrespondingWxmlPath(tsFilePath: string): string | null {
  const basePath = tsFilePath.replace(/\.(ts|js)$/, '');
  const wxmlPath = `${basePath}.wxml`;

  if (fs.existsSync(wxmlPath)) {
    return wxmlPath;
  }

  return null;
}

/**
 * 获取对应的TypeScript文件路径
 * @param wxmlFilePath WXML文件路径
 * @returns TypeScript文件路径，如果不存在则返回null
 */
export function getCorrespondingTsPath(wxmlFilePath: string): string | null {
  const basePath = wxmlFilePath.replace(/\.wxml$/, '');

  // 优先查找 .ts 文件
  const tsPath = `${basePath}.ts`;
  if (fs.existsSync(tsPath)) {
    return tsPath;
  }

  // 如果没有 .ts 文件，查找 .js 文件
  const jsPath = `${basePath}.js`;
  if (fs.existsSync(jsPath)) {
    return jsPath;
  }

  return null;
}

/**
 * 从WXML内容中提取所有的class和id
 * @param wxmlContent WXML文件内容
 * @returns 包含所有class和id的数组
 */
export function extractClassesAndIds(wxmlContent: string): { classes: string[], ids: string[] } {
  const classes: string[] = [];
  const ids: string[] = [];

  // 使用预编译的正则表达式提取class属性
  const classMatches = wxmlContent.matchAll(CLASS_ATTR_REGEX);
  for (const match of classMatches) {
    const classNames = match[1].split(/\s+/).filter(name => name.trim());
    classes.push(...classNames);
  }

  // 使用预编译的正则表达式提取id属性
  const idMatches = wxmlContent.matchAll(ID_ATTR_REGEX);
  for (const match of idMatches) {
    ids.push(match[1].trim());
  }

  return {
    classes: [...new Set(classes)], // 去重
    ids: [...new Set(ids)]          // 去重
  };
}
