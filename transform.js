const fs = require('node:fs')
const path = require('node:path')

const clashRulesDir = path.join(__dirname, 'clash-rules')
const quanxRulesDir = path.join(__dirname, 'quanx-rules')
const transformConfigPath = path.join(__dirname, 'transform-whitelist.json')

// Clash 规则类型 -> Quantumult X 规则类型映射
const RULE_TYPE_MAP = {
  'DOMAIN-SUFFIX': 'host-suffix',
  'DOMAIN-KEYWORD': 'host-keyword',
  'DOMAIN': 'host',
  'IP-CIDR': 'ip-cidr',
  'IP-CIDR6': 'ip6-cidr',
}

/**
 * 读取转换配置。
 * whitelist: 白名单内文件将跳过转换。
 * policies: txt 文件转换时使用的策略名称；未配置时使用文件名。
 * 文件匹配支持文件名（如 steamdl.txt）或相对路径（如 clash-rules/steamdl.txt）。
 */
function loadTransformConfig() {
  if (!fs.existsSync(transformConfigPath)) {
    return {
      whitelist: new Set(),
      policies: new Map(),
    }
  }

  let config
  try {
    config = JSON.parse(fs.readFileSync(transformConfigPath, 'utf8'))
  } catch (err) {
    console.error(`读取转换配置失败: ${transformConfigPath}`, err)
    process.exit(1)
  }

  const whitelist = Array.isArray(config) ? config : config.whitelist || config.files || []
  if (!Array.isArray(whitelist)) {
    console.error('转换配置中的 whitelist 必须是数组')
    process.exit(1)
  }

  const policies = Array.isArray(config) ? {} : config.policies || config.rules || {}
  if (!policies || typeof policies !== 'object' || Array.isArray(policies)) {
    console.error('转换配置中的 policies 必须是对象')
    process.exit(1)
  }

  return {
    whitelist: new Set(
      whitelist
        .filter((file) => typeof file === 'string')
        .map((file) => normalizeConfigFile(file))
        .filter((file) => file !== ''),
    ),
    policies: new Map(
      Object.entries(policies)
        .filter((entry) => typeof entry[1] === 'string' && entry[1].trim() !== '')
        .map(([file, policy]) => [normalizeConfigFile(file), policy.trim()]),
    ),
  }
}

function normalizeConfigFile(file) {
  return file.trim().replace(/\\/g, '/').replace(/^\.\//, '')
}

function getFileMatchKeys(inputFile) {
  const absoluteFile = path.resolve(inputFile)
  const baseName = path.basename(inputFile)
  const nameWithoutExt = path.parse(baseName).name

  return [
    normalizeConfigFile(path.relative(__dirname, absoluteFile)),
    normalizeConfigFile(path.relative(clashRulesDir, absoluteFile)),
    baseName,
    nameWithoutExt,
  ]
}

function isWhitelisted(inputFile) {
  return getFileMatchKeys(inputFile).some((file) => transformConfig.whitelist.has(file))
}

function getPolicy(inputFile) {
  const configuredPolicy = getFileMatchKeys(inputFile)
    .map((file) => transformConfig.policies.get(file))
    .find((policy) => policy)

  return configuredPolicy || path.parse(path.basename(inputFile)).name
}

function getSupportedFiles(files) {
  return files
    .filter((file) => typeof file === 'string')
    .filter((file) => ['.txt', '.yaml'].includes(path.extname(file).toLowerCase()))
}

/**
 * 将 txt 格式的域名列表转换为 Quantumult X 规则行
 * @param {string} data 文件内容
 * @param {string} policy 策略名称
 */
function convertTxtLines(data, policy) {
  return data
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((domain) => {
      const normalizedDomain = domain.startsWith('*.') || domain.startsWith('+.') ? domain.substring(2) : domain
      const ruleType = normalizedDomain.includes('.') ? 'host-suffix' : 'host-keyword'
      return `${ruleType},${normalizedDomain},${policy}`
    })
}

/**
 * 将 yaml payload 格式的规则转换为 Quantumult X 规则行
 */
function convertYamlLines(data) {
  return data
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- ') && !line.startsWith('- #'))
    .map((line) => line.substring(2).trim()) // 去掉 "- " 前缀
    .filter((line) => !line.startsWith('#'))
    .flatMap((entry) => {
      const parts = entry.split(',').map((p) => p.trim())
      if (parts.length < 3) return []
      const [clashType, value, action] = parts
      const qxType = RULE_TYPE_MAP[clashType.toUpperCase()]
      if (!qxType) return [] // 跳过不支持的规则类型
      const qxAction = action.toLowerCase()
      return [`${qxType},${value},${qxAction}`]
    })
}

/**
 * 将单个文件转换并写入 quanx-rules 目录（输出为 .list）
 */
function convertFile(inputFile) {
  if (isWhitelisted(inputFile)) {
    console.log(`跳过白名单文件: ${path.basename(inputFile)}`)
    return
  }

  const ext = path.extname(inputFile).toLowerCase()
  const inputFileNameWithoutExt = path.parse(path.basename(inputFile)).name
  const policy = getPolicy(inputFile)
  const outputFilePath = path.join(quanxRulesDir, `${inputFileNameWithoutExt}.list`)

  fs.readFile(inputFile, 'utf8', (err, data) => {
    if (err) {
      console.error(`读取输入文件失败: ${inputFile}`, err)
      return
    }

    const rules = ext === '.yaml' ? convertYamlLines(data) : convertTxtLines(data, policy)
    const outputContent = rules.join('\n')

    fs.writeFile(outputFilePath, outputContent, 'utf8', (err) => {
      if (err) {
        console.error(`写入输出文件失败: ${outputFilePath}`, err)
        return
      }
      console.log(`转换完成: ${path.basename(inputFile)} -> ${outputFilePath}`)
    })
  })
}

const transformConfig = loadTransformConfig()
const inputFile = process.argv[2]

if (inputFile) {
  // 指定了文件，直接转换到 quanx-rules 目录
  convertFile(path.resolve(inputFile))
} else {
  // 未指定文件，批量转换 clash-rules 下所有 .txt 和 .yaml 文件
  fs.readdir(clashRulesDir, (err, files) => {
    if (err) {
      console.error(`读取 clash-rules 目录失败: ${clashRulesDir}`, err)
      process.exit(1)
    }

    const targetFiles = getSupportedFiles(files)

    if (targetFiles.length === 0) {
      console.log('clash-rules 目录下没有找到任何 .txt 或 .yaml 文件')
      return
    }

    targetFiles.forEach((file) => convertFile(path.join(clashRulesDir, file)))
  })
}
