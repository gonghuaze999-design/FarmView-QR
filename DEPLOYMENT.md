# FarmView-QR 部署指南（腾讯云轻量服务器）

> 目标：在**不影响现有服务**的前提下，把项目发布到你的新加坡服务器（`43.156.153.252`），并让 Hoire 能成功回调推送。

本指南按“最小影响”设计：
- 新服务仅占用容器端口映射 `3001:3000`。
- 不改已有应用端口，只新增一个入口（可选：Nginx 反代）。
- 支持两种方式：
  - **A. 先用 IP 跑通（推荐你当前阶段）**
  - **B. 后续再切换到域名 + HTTPS（生产推荐）**

---

## 1. 核心问题先回答

### 1.1 二维码可以直接解析 IP 吗？
可以。二维码里直接放 `http://43.156.153.252:3001/`（或你反代后的 80/443 地址）即可打开页面。

### 1.2 Hoire 订阅回调可以先用 IP 吗？
可以先试：
- `APP_URL=http://43.156.153.252:3001`（直连容器映射端口）
- 或 `APP_URL=http://43.156.153.252`（如果你用 Nginx 80 反代到 3001）

> 说明：是否必须 HTTPS 取决于 Hoire 平台策略。若 Hoire 强制 HTTPS，后续必须上证书和域名。

### 1.3 新加坡服务器要做哪些设置？
最少要做 4 件事：
1. 安装 Docker / Compose。
2. 开放端口（至少 3001；若用反代则开 80/443）。
3. 拉代码并配置 `.env`。
4. 启动容器并验证 `/api/iot/ping`。

---

## 2. 你的服务器准备清单（43.156.153.252）

## 2.1 登录服务器

```bash
ssh root@43.156.153.252
```

## 2.2 检查 Docker 与 Compose

```bash
docker --version
docker compose version
```

如果未安装，请先安装（Ubuntu 示例）：

```bash
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## 2.3 放通安全组/防火墙端口

腾讯云控制台安全组至少放行：
- TCP 22（SSH）
- TCP 3001（IP 直连方案）
- TCP 80/443（如果要 Nginx 反代或 HTTPS）

服务器本机若开了 UFW：

```bash
ufw allow 22/tcp
ufw allow 3001/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw status
```

---

## 3. 从 GitHub 部署到服务器（你问“代码怎么发布”）

## 3.1 拉取仓库

```bash
cd /opt
git clone <你的GitHub仓库地址> FarmView-QR
cd /opt/FarmView-QR
```

后续更新发布：

```bash
cd /opt/FarmView-QR
git pull
docker compose up -d --build
```

## 3.2 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`（先按 IP 方案跑通）：

```env
HOIRE_ACCOUNT=你的账号
HOIRE_PASSWORD=你的密码
APP_URL=http://43.156.153.252:3001
PORT=3000
VITE_AMAP_KEY=可选
VITE_AMAP_SECURITY_CODE=可选
```

> 注意：
> - `APP_URL` 必须是 Hoire 能访问到的地址。
> - 不要写 `localhost` 或内网地址。
> - 不要带尾斜杠。

## 3.3 启动服务

```bash
docker compose up -d --build
```

## 3.4 验证运行状态

```bash
docker compose ps
docker compose logs -f --tail=100
```

你应该看到启动日志包含：
- `APP_URL=...`
- `Hoire callback URL=.../api/iot/receive`

---

## 4. 立刻验证 Hoire 回调入口（最关键）

## 4.1 验证健康检查接口

在你本机浏览器打开：

- `http://43.156.153.252:3001/api/iot/ping`

或命令行：

```bash
curl http://43.156.153.252:3001/api/iot/ping
```

期望返回：

```json
{
  "ok": true,
  "message": "IoT callback endpoint is reachable",
  "callbackUrl": "http://43.156.153.252:3001/api/iot/receive"
}
```

## 4.2 在前端触发订阅

1. 打开：`http://43.156.153.252:3001/`
2. 点击“订阅所选设备”
3. 点击“查看订阅详情”

## 4.3 查看服务器日志

```bash
cd /opt/FarmView-QR
docker compose logs -f --tail=200
```

关注三类日志：
- `[Subscribe] 发起订阅请求`
- `[Subscribe] Hoire 返回`
- `[IOT Push] 收到物联网平台推送请求`

## 4.4 验证数据是否入库（内存）

```bash
curl http://43.156.153.252:3001/api/iot/latest
```

返回非空 JSON 即表示 push 已经打通。

---

## 5. 可选：用 Nginx 占用 80（避免二维码带端口）

如果你希望二维码简洁（`http://43.156.153.252/`），可加 Nginx 反代：

```nginx
server {
  listen 80;
  server_name 43.156.153.252;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

重载：

```bash
nginx -t
systemctl reload nginx
```

此时 `.env` 中 `APP_URL` 改成：

```env
APP_URL=http://43.156.153.252
```

然后重启容器：

```bash
cd /opt/FarmView-QR
docker compose up -d --build
```

---

## 6. 后续切换到域名（你备案域名后续可做）

当你把备案域名绑定到该 IP 后：
1. DNS A 记录指向 `43.156.153.252`
2. Nginx `server_name` 改成域名
3. 配 HTTPS 证书
4. `.env` 把 `APP_URL` 改为 `https://你的域名`
5. 重启容器

---

## 7. 常见问题排查

### 7.1 Hoire 一直不推送

- 先确认 `APP_URL/api/iot/ping` 能公网访问。
- 确认 `APP_URL` 不是 `localhost`、不是内网地址。
- 确认安全组和服务器防火墙端口已放通。
- 查看 Hoire 是否要求 HTTPS 或白名单。

### 7.2 端口冲突（不影响现有服务原则）

查看占用：

```bash
ss -lntp | grep -E ':3001|:80|:443'
```

如 3001 被占用，改 `docker-compose.yml` 为其他宿主端口（如 `3101:3000`），并同步更新 `APP_URL`。

### 7.3 快速回滚

```bash
cd /opt/FarmView-QR
docker compose down
```

仅停止新服务，不影响其他应用。

---

## 8. 一句话执行顺序（给新手）

1. 开 3001 端口。  
2. `git clone` 代码。  
3. 配 `.env`（`APP_URL=http://43.156.153.252:3001`）。  
4. `docker compose up -d --build`。  
5. 打开 `/api/iot/ping`。  
6. 前端点“订阅所选设备”。  
7. 看 `/api/iot/latest` 和容器日志。  

如果你愿意，我下一步就按这个清单，逐条带你执行（你每步给我截图，我给你下一步命令）。
