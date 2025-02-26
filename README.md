# 小程序魔法师

> 微信小程序开发增强工具：自定义组件跳转、SCSS变量管理、组件创建等多功能集成

## 功能介绍

### 1. 自定义组件跳转
- 支持WXML文件中自定义组件的定义跳转
- 支持别名路径引入的自定义组件跳转（如 `@components/button/index`）
- 可配置默认打开的文件类型（ts、js、wxml、scss、json）

### 2. SCSS增强功能
- SCSS文件中的变量引用跳转
- SCSS变量悬停提示，显示变量值和相关信息
- 一键将CSS值转换为SCSS变量
- Design Token管理支持
- 支持SCSS文件中的@import语句跳转，包括相对路径和别名路径

### 3. 组件创建
- 右键菜单快速创建微信小程序组件
- 自动生成组件所需的所有文件（ts/js、wxml、scss、json）
- 可配置是否使用组件名作为文件名（而非默认的index）

## 使用方法

### 自定义组件跳转
1. 在WXML文件中，按住`Ctrl`（Windows）或`Cmd`（Mac）点击自定义组件标签，即可跳转到组件定义
2. 支持别名路径，如`<custom-comp></custom-comp>`可以跳转到对应的组件文件

### SCSS变量管理
1. 在SCSS文件中，按住`Ctrl`（Windows）或`Cmd`（Mac）点击SCSS变量（以$开头）可以跳转到变量定义
2. 鼠标悬停在SCSS变量上可以查看变量值和相关信息
3. 转换CSS值为SCSS变量：
   - 选中CSS值后，按`Cmd+Alt+V`（Mac）或`Ctrl+Alt+V`（Windows）
   - 或者直接选中CSS值，右键菜单选择"转换为SCSS变量"
4. 在SCSS文件中，按住`Ctrl`（Windows）或`Cmd`（Mac）点击@import语句中的路径可以跳转到相应文件

### 创建组件
1. 在VS Code资源管理器中右键点击目标文件夹
2. 选择"创建微信小程序组件"
3. 输入组件名称，插件将自动创建所需的所有文件

## 配置选项

在VS Code设置中可以自定义以下选项：

| 配置项 | 说明 | 默认值 |
| --- | --- | --- |
| `miniCustomComponentJump.defaultOpenFileType` | 自定义组件默认打开的文件类型 | `"ts"` |
| `miniCustomComponentJump.aliasJumpFileTypes` | 别名跳转时尝试打开的文件类型顺序 | `["ts", "js"]` |
| `miniCustomComponentJump.useComponentNameAsFileName` | 使用组件名作为文件名，而不是使用index | `false` |
| `miniCustomComponentJump.designTokenPath` | Design Token文件路径，相对于项目根目录 | `"src/assets/style/design-token.scss"` |

## 快捷键

| 功能 | Windows/Linux | Mac |
| --- | --- | --- |
| 转换为SCSS变量 | `Ctrl+Alt+V` | `Cmd+Alt+V` |
| SCSS变量跳转 | `Ctrl+点击` | `Cmd+点击` |
| 组件定义跳转 | `Ctrl+点击` | `Cmd+点击` |
| SCSS @import 跳转 | `Ctrl+点击` | `Cmd+点击` |

## 更新日志

### 0.0.7
- 更新插件名称为"小程序魔法师"
- 新增SCSS变量管理功能
- 新增Design Token支持
- 新增组件创建功能
- 优化自定义组件跳转体验
- 支持SCSS @import 语句跳转

## 致谢

本项目基于 [minapp-comp-definition](https://github.com/wjf2016/minapp-comp-definition) 开发，感谢原作者的贡献。
