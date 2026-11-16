# 技术设计

## 实现

- `source-normalization.ts` 提供共享的 URL 和 VideoSource 归一化函数，无网络请求。
- 保存格式采用 baseUrl=源站 origin，searchPath/detailPath=路径与查询参数；保持现有 API 拼接方式。
- 添加表单支持地址或单个 JSON，批量导入器共用归一化逻辑。
- 编辑表单显示完整搜索接口；未修改地址时保留原始搜索和详情配置。
- 默认 ID 根据归一化接口确定性生成，显式 ID 和编辑中的历史 ID 优先。
- 播放器删除数字输入设置项，保留现有倍速滑块与持久化逻辑。

## 异常处理

- 仅接受 HTTP/HTTPS 地址，校验域名与协议。
- JSON 缺少接口字段、批量列表全无效和单源窗口输入多个源时显示具体提示。
- 自定义接口路径保留；域名补齐规则以 MacCMS 标准路径为默认。

## 验证

运行 TypeScript 和全项目 lint；使用 node:test 验证域名补齐、vod/json 适配、查询参数处理、完整路径保留、JSON 包装、ID 稳定性和 JSON 往返一致性。
