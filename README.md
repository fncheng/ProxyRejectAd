# ProxyRejectAd

将 Clash 格式的域名规则（`.txt`）批量转换为 Quantumult X 支持的 `.snippet` 规则文件。

## 目录结构

```
ProxyRejectAd/
├── transform.js        # 转换脚本
├── clash-rules/        # 存放 Clash 格式规则（.txt）
│   ├── reject.txt
│   └── netflix.txt
└── quanx-rules/        # 输出目录，存放转换后的 Quantumult X 规则（.snippet）
    ├── reject.snippet
    └── netflix.snippet
```

## 环境要求

- Node.js（无需额外依赖）

## 用法

### 转换单个文件

指定任意 `.txt` 规则文件，输出同名 `.snippet` 到 `quanx-rules/` 目录。

```bash
node transform.js clash-rules/reject.txt
```

输出：`quanx-rules/reject.snippet`

### 批量转换

不传参数时，自动将 `clash-rules/` 目录下所有 `.txt` 文件转换并输出到 `quanx-rules/`。

```bash
node transform.js
```

## 规则转换逻辑

| 输入格式（clash-rules/*.txt） | 输出格式（quanx-rules/*.snippet）           |
| ----------------------------- | ------------------------------------------- |
| `example.com`                 | `host-suffix,example.com,reject`            |
| `*.example.com`               | `host-suffix,example.com,reject`            |
| `keyword`（不含 `.`）         | `host-keyword,keyword,reject`               |

- 以 `*.` 开头的域名会去除通配符前缀，使用 `host-suffix` 类型
- 不含 `.` 的裸关键词使用 `host-keyword` 类型
- 其余域名统一使用 `host-suffix` 类型
