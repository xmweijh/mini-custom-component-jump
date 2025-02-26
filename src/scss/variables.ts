import * as sass from 'sass';

export interface ScssVariable {
  name: string;
  value: string;
  description: string;
  line: number;
}

// 简化变量映射，直接使用变量名前缀匹配
export const propertyToVariablePrefix: Record<string, string> = {
  'margin': 'margin',
  'padding': 'padding',
  'font-size': 'font-size',
  'line-height': 'line-height',
  'border-radius': 'border-radius',
  'gap': 'margin',  // gap 可以使用 margin 变量
};

export function parseScssVariables(content: string): ScssVariable[] {
  const variables: ScssVariable[] = [];
  const lines = content.split('\n');
  
  console.log('Parsing SCSS content:', content);
  
  // 创建一个临时的SCSS内容来计算实际值
  let tempScssContent = '';
  
  // 第一遍：收集所有变量定义
  lines.forEach((line, index) => {
    const match = line.match(/^\s*\$([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/);
    if (match) {
      const name = match[1].trim();
      let value = match[2].trim();
      
      // 移除值中的行内注释
      value = value.replace(/\/\/.*$/, '').trim();
      value = value.replace(/\/\*.*\*\//, '').trim();
      
      // 添加到临时SCSS内容
      tempScssContent += `$${name}: ${value};\n`;
      
      // 获取变量注释
      let description = '';
      let i = index - 1;
      while (i >= 0) {
        const prevLine = lines[i].trim();
        if (prevLine.startsWith('//')) {
          description = prevLine.substring(2).trim() + ' ' + description;
        } else if (prevLine.startsWith('/*') || prevLine.startsWith('*')) {
          const commentText = prevLine
            .replace(/^\/\*+/, '')
            .replace(/\*+\/$/, '')
            .replace(/^\*\s*/, '')
            .trim();
          if (commentText) {
            description = commentText + ' ' + description;
          }
        } else {
          break;
        }
        i--;
      }
      
      variables.push({
        name,
        value,  // 先存储原始值
        description: description.trim(),
        line: index
      });
    }
  });
  
  // 第二遍：计算实际值
  try {
    // 为每个变量创建一个测试选择器
    variables.forEach((variable, index) => {
      tempScssContent += `.test-${index} { value: ${variable.value}; }\n`;
    });
    
    console.log('Evaluating SCSS:', tempScssContent);
    
    // 使用sass编译器计算实际值
    const result = sass.compileString(tempScssContent);
    const cssContent = result.css;
    
    // 从编译结果中提取实际值
    variables.forEach((variable, index) => {
      const selector = `.test-${index}`;
      const valueMatch = cssContent.match(new RegExp(`${selector}\\s*{\\s*value:\\s*([^;}]+)`));
      if (valueMatch) {
        variable.value = valueMatch[1].trim();
      }
    });
  } catch (error) {
    console.error('Error evaluating SCSS:', error);
  }
  
  console.log('Parsed variables with computed values:', variables);
  return variables;
}

export function evaluateScssValue(value: string, variables: ScssVariable[]): string {
  try {
    // 创建一个临时的SCSS文件内容
    let scssContent = '';
    // 按照依赖顺序添加变量
    const addedVariables = new Set<string>();
    const addVariable = (variable: ScssVariable) => {
      if (addedVariables.has(variable.name)) {
        return;
      }
      // 检查值中是否引用了其他变量
      const refs = variable.value.match(/\$[\w-]+/g) || [];
      refs.forEach(ref => {
        const refName = ref.substring(1);
        const refVar = variables.find(v => v.name === refName);
        if (refVar && !addedVariables.has(refName)) {
          addVariable(refVar);
        }
      });
      scssContent += `$${variable.name}: ${variable.value};\n`;
      addedVariables.add(variable.name);
    };
    
    variables.forEach(addVariable);
    scssContent += `.result { value: ${value}; }`;
    
    console.log('Evaluating SCSS:', scssContent);
    
    // 使用sass编译器计算实际值
    const result = sass.compileString(scssContent);
    const match = result.css.match(/value:\s*([^;]+);/);
    return match ? match[1].trim() : value;
  } catch (error) {
    console.error('Error evaluating SCSS:', error);
    return value;
  }
}

export function findMatchingVariable(value: string, property: string, variables: ScssVariable[]): ScssVariable | null {
  console.log('Finding matching variable for:', { value, property });
  
  // 只匹配rpx值
  const valueMatch = value.match(/^(\d+)rpx$/);
  if (!valueMatch) {
    return null;
  }
  
  const numericValue = parseInt(valueMatch[1]);
  
  // 获取属性对应的变量前缀
  let prefix = '';
  for (const [prop, varPrefix] of Object.entries(propertyToVariablePrefix)) {
    if (property.startsWith(prop)) {
      prefix = varPrefix;
      break;
    }
  }
  
  if (!prefix) {
    console.log('No matching prefix found for property:', property);
    return null;
  }
  
  // 在所有变量中查找完全匹配的值，排除私有变量（$-开头）并匹配属性类型
  const matchingVariable = variables.find(variable => {
    // 跳过私有变量（$-开头）
    if (variable.name.startsWith('-')) {
      return false;
    }
    
    // 确保变量名前缀匹配
    if (!variable.name.startsWith(prefix)) {
      return false;
    }
    
    // 确保变量值使用rpx单位
    const varValueMatch = variable.value.match(/^(\d+)rpx$/);
    if (!varValueMatch) {
      return false;
    }
    
    const varNumericValue = parseInt(varValueMatch[1]);
    // 严格相等匹配
    return numericValue === varNumericValue;
  }) || null;
  
  console.log('Matching variable found:', matchingVariable);
  return matchingVariable;
} 