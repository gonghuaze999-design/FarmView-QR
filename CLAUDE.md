# FarmView-QR — Claude 工作指引

## 记忆文件位置
每次对话开始时，请读取以下文件恢复项目上下文：
- `.claude/memory/MEMORY.md` — 项目进度、待办事项、技术关键点
- `.claude/memory/data-fields.md` — 接口字段对照表
- `.claude/memory/plan.md` — 详细开发计划

> 这些文件不在 git 追踪范围内（已加入 .gitignore），随项目文件夹物理迁移。

## 记忆更新原则
完成以下任一阶段性进展时，同步更新 `.claude/memory/` 中对应文件：
- 某个页面区域数据接口对接完成
- Docker 部署流程验证完成
- sites-config.json 有新基地加入
- 重要 Bug 修复完成

## 项目概览
农业基地 IoT 监控展示页，扫码免登陆，单页面 React + Vite。
- 测试站点：`http://43.156.153.252:3101/?site=xinjiang-01`
- 后端：`http://cpca.hyspi.com:54082/`
- 部署：Docker，端口 3101
