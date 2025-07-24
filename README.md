# 小程序宝具库

微信小程序开发增强工具：自定义组件跳转、SCSS变量管理、组件创建、埋点检测等多功能集成

## 功能特性

### 1. 自定义组件跳转
- **WXML中组件跳转**: 在WXML文件中，点击自定义组件标签可直接跳转到对应的组件文件
- **支持别名路径**: 自动解析项目中配置的路径别名，支持从别名路径跳转到实际文件
- **智能文件类型选择**: 根据配置优先打开指定类型的文件（ts/js/wxml等）

### 2. SCSS变量管理
- **变量定义跳转**: 点击SCSS变量可跳转到其定义位置
- **智能悬停提示**: 悬停在SCSS变量上显示详细信息，包括计算后的值
- **Design Token支持**: 自动从design-token文件中查找变量定义
- **快速转换工具**: 选中样式值后可快速转换为SCSS变量

### 3. 埋点检测功能 🆕
- **实时检测**: 自动检测TypeScript文件中的`lxCore.mvObserve`配置与WXML元素的匹配关系
- **命名规范检查**: 检查埋点选择器是否以`lx-`开头，确保命名规范一致性
- **错误标注**:
  - 红色错误：选择器在WXML中找不到对应元素
  - 黄色警告：选择器不符合`lx-`前缀命名规范
- **智能悬停**:
  - 在TS文件中悬停在`mvObserve`上显示配置详情、验证结果和命名规范检查
  - 在WXML文件中悬停在class/id上显示相关的埋点配置信息
- **修复建议**: 提供相似元素的修复建议和命名规范建议，帮助快速定位问题

### 4. 组件创建工具
- **一键创建**: 右键文件夹可快速创建完整的小程序组件（包含ts、wxml、scss、json文件）
- **模板定制**: 支持自定义组件模板
- **智能命名**: 根据组件名自动生成合适的文件名

## 安装使用

1. 在VSCode扩展市场搜索"小程序宝具库"
2. 点击安装
3. 重启VSCode

## 配置选项

在VSCode设置中可以配置以下选项：

```json
{
  // 自定义组件默认打开的文件类型
  "miniCustomComponentJump.defaultOpenFileType": "ts",

  // 别名跳转时尝试打开的文件类型顺序
  "miniCustomComponentJump.aliasJumpFileTypes": ["ts", "js"],

  // 是否使用组件名作为文件名
  "miniCustomComponentJump.useComponentNameAsFileName": false,

  // Design Token 文件路径
  "miniCustomComponentJump.designTokenPath": "src/assets/style/design-token.scss"
}
```

## 埋点检测功能详解

### 支持的埋点写法

插件支持检测以下格式的埋点配置：

```typescript
// TypeScript文件
this.data._observer = lxCore.mvObserve(this, {
  observeDom: '.goods-item',  // 监听的DOM选择器
  getBid: (dataset) => `b_sg_xingongji_c_${dataset.bid}_mv`,
  useParams: (dataset) => ({
    goods_id: dataset.goodsId,
    position: dataset.position
  })
})
```

### 检测功能

1. **实时验证**: 当你修改TypeScript中的`observeDom`选择器或WXML中的class/id时，插件会立即检查匹配关系和命名规范

2. **错误提示**:
   - 红色波浪线：选择器在WXML中找不到匹配元素
   - 黄色波浪线：选择器不符合`lx-`前缀命名规范
   - 蓝色信息提示：在WXML中发现相关的埋点配置

3. **命名规范检查**:
   - 检查class选择器：`.lx-goods-item` ✅ vs `.goods-item` ⚠️
   - 检查id选择器：`#lx-special-element` ✅ vs `#special-element` ⚠️
   - 提供符合规范的建议名称

4. **悬停信息**:
   - **TS文件**: 悬停在`lxCore.mvObserve`上显示配置详情、验证状态和命名规范检查
   - **WXML文件**: 悬停在class或id上显示相关的埋点配置和规范符合情况

### 使用示例

假设你有以下文件结构：
```
src/
  pages/
    goods/
      goods.ts
      goods.wxml
```

**goods.ts**:
```typescript
Page({
  onLoad() {
    // ✅ 符合规范的配置
    this.data._goodsObserver = lxCore.mvObserve(this, {
      observeDom: '.lx-goods-item',  // 使用lx-前缀
      getBid: (dataset) => `goods_${dataset.id}_click`,
      useParams: (dataset) => ({
        goods_id: dataset.goodsId
      })
    });

    // ⚠️ 不符合规范的配置（会显示警告）
    this.data._observer = lxCore.mvObserve(this, {
      observeDom: '.goods-item',  // 缺少lx-前缀
      getBid: (dataset) => `goods_${dataset.id}_click`,
      useParams: (dataset) => ({
        goods_id: dataset.goodsId
      })
    })
  }
})
```

**goods.wxml**:
```xml
<view class="goods-list">
  <!-- 符合规范的元素 -->
  <view class="lx-goods-item" data-goods-id="{{item.id}}" wx:for="{{goodsList}}">
    {{item.name}}
  </view>

  <!-- 不符合规范但存在的元素 -->
  <view class="goods-item" data-goods-id="{{item.id}}" wx:for="{{oldGoodsList}}">
    {{item.name}}
  </view>
</view>
```

在这个例子中：
- ✅ `.lx-goods-item`：完全符合规范，无任何提示
- ⚠️ `.goods-item`：元素存在但不符合命名规范，显示黄色警告
- 🔍 悬停在选择器上会显示相关的埋点配置信息和命名规范检查结果
- ⚠️ 如果你改变了class名，插件会立即标记错误并提供修复建议

## 快捷键

- `Ctrl+Alt+V` (Windows/Linux) / `Cmd+Alt+V` (Mac): 转换选中的样式值为SCSS变量

## 注意事项

1. 确保项目根目录包含`tsconfig.json`或`package.json`文件
2. 别名跳转需要在项目根目录配置相应的路径映射
3. 埋点检测功能需要TS/JS文件和WXML文件在同一目录下且文件名相同（除扩展名外）

## 更新日志

### v0.0.8
- 🆕 新增埋点检测功能
- 🆕 支持`lxCore.mvObserve`配置验证
- 🆕 智能悬停提示显示埋点配置详情
- 🆕 实时检测选择器与WXML元素的匹配关系
- 🆕 提供修复建议和错误标注

### v0.0.7
- 🐛 修复别名路径解析问题
- ✨ 优化SCSS变量悬停提示
- ✨ 改进组件跳转逻辑

### v0.0.6
- 🆕 新增组件创建命令
- 🆕 支持快速转换SCSS变量
- ✨ 优化用户体验

## 贡献

欢迎提交Issue和Pull Request来帮助改进这个项目。

## 许可证

MIT
