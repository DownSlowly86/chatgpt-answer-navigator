# ChatGPT Answer Navigator

这是一个适用于 Microsoft Edge 的本地浏览器扩展。打开 ChatGPT 对话记录时，它会在页面右侧显示实时对话目录：

- 目录按回答轮次显示。
- 每一项显示对应问题和回答摘要。
- 点击目录项可跳转到该回答开头。
- 支持紧凑/展开两种预览模式。
- 支持收起为右侧小按钮。
- 支持 `chatgpt.com` 和旧域名 `chat.openai.com`。

## 在 Edge 中安装

1. 打开 Edge，进入 `edge://extensions/`。
2. 打开左侧的“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择这个文件夹：

   `C:\Users\DownSlowly\Documents\chatgpt网页版导航条`

5. 打开或刷新 ChatGPT 对话页面。

如果已经加载过旧版本，先在 `edge://extensions/` 里点击这个扩展卡片上的“重新加载”，再刷新 ChatGPT 页面。

## 文件说明

- `manifest.json`：扩展配置。
- `content.js`：扫描对话、生成目录、处理跳转和模式切换。
- `styles.css`：右侧目录面板样式。

## 备注

当前实现会识别页面里已经加载到 DOM 的 ChatGPT 问答。很长的历史对话如果网页本身尚未加载较早内容，需要先滚动让 ChatGPT 加载出来，目录会自动更新。
