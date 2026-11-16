# 视频源自动适配与倍速设置精简

## 范围

将域名、MacCMS 接口 URL 和视频源 JSON 配置转换为项目的 VideoSource。格式转换通过本地规则完成，源站接口可用性由源站决定。

## 验收要求

1. 当用户打开播放器倍速设置时，播放器应提供一个长按倍速滑块，范围保持 0.25 至 8 倍。
2. 当用户添加域名或 MacCMS 不完整接口路径时，系统应补齐 `/api.php/provide/vod/`，省略协议时使用 HTTPS。
3. 当用户提供完整接口时，系统应保留源站协议、自定义路径和必要查询参数，并清除旧的 ac、wd、ids、pg 参数。
4. 当地址使用 MacCMS XML 输出形式时，系统应将已知的 at=xml 或 /at/xml 转换为 JSON 输出形式。
5. 当用户提供单个 JSON 配置时，系统应识别 baseUrl、url 或 api 地址字段；名称留空时使用 JSON 名称或域名。
6. 当用户批量导入 JSON 时，系统应支持数组、sources、sites、list 和 api_site 包装，保留有效项目并对全无效输入显示错误。
7. 当用户编辑现有源时，系统应保持源 ID，未修改接口时保持搜索路径、详情路径和请求头。
8. 当归一化配置再次导入或经 JSON 序列化再解析时，系统应保持 ID、接口路径、分组、启用状态与请求头。
9. 当添加窗口收到多个视频源时，系统应提示用户使用批量导入。

## 输入示例

- `example.com`
- `https://example.com/api.php/provide/vod/?ac=list`
- `https://example.com/api.php/provide/json/`
- `{"name":"视频源","api":"https://example.com"}`

JSON 指的是带接口地址的视频源配置。视频列表响应本身缺少源站地址，需要用户提供对应接口 URL。
