const fs = require('node:fs')
const path = require('node:path')

const clashRulesDir = path.join(__dirname, 'clash-rules')
const quanxRulesDir = path.join(__dirname, 'quanx-rules')
const transformWhitelistPath = path.join(__dirname, 'transform-whitelist.json')

// Clash 规则类型 -> Quantumult X 规则类型映射
const RULE_TYPE_MAP = {
  'DOMAIN-SUFFIX': 'host-suffix',
  'DOMAIN-KEYWORD': 'host-keyword',
  'DOMAIN': 'host',
  'IP-CIDR': 'ip-cidr',
  'IP-CIDR6': 'ip6-cidr',
}

/**
 * 读取转换白名单。白名单内文件将跳过转换。
 * 支持写文件名（如 steamdl.txt）或相对路径（如 clash-rules/steamdl.txt）。
 */
function loadTransformWhitelist() {
  if (!fs.existsSync(transformWhitelistPath)) {
    return new Set()
  }

  let config
  try {
    config = JSON.parse(fs.readFileSync(transformWhitelistPath, 'utf8'))
  } catch (err) {
    console.error(`读取转换白名单失败: ${transformWhitelistPath}`, err)
    process.exit(1)
  }

  const files = Array.isArray(config) ? config : config.files
  if (!Array.isArray(files)) {
    console.error('转换白名单配置必须是数组，或包含 files 数组')
    process.exit(1)
  }

  return new Set(
    files
      .filter((file) => typeof file === 'string')
      .map((file) => normalizeWhitelistEntry(file))
      .filter((file) => file !== ''),
  )
}

function normalizeWhitelistEntry(file) {
  return file.trim().replace(/\\/g, '/').replace(/^\.\//, '')
}

function isWhitelisted(inputFile) {
  const absoluteFile = path.resolve(inputFile)
  const relativeToRoot = normalizeWhitelistEntry(path.relative(__dirname, absoluteFile))
  const relativeToClashRules = normalizeWhitelistEntry(path.relative(clashRulesDir, absoluteFile))
  const baseName = path.basename(inputFile)

  return [relativeToRoot, relativeToClashRules, baseName].some((file) => transformWhitelist.has(file))
}

/**
 * 将 txt 格式的域名列表转换为 Quantumult X 规则行
 * @param {string} data 文件内容
 * @param {string} policy 策略名称（取自文件名）
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
  const outputFilePath = path.join(quanxRulesDir, `${inputFileNameWithoutExt}.list`)

  fs.readFile(inputFile, 'utf8', (err, data) => {
    if (err) {
      console.error(`读取输入文件失败: ${inputFile}`, err)
      return
    }

    const rules = ext === '.yaml' ? convertYamlLines(data) : convertTxtLines(data, inputFileNameWithoutExt)
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

const transformWhitelist = loadTransformWhitelist()
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

    const targetFiles = files.filter((f) => ['.txt', '.yaml'].includes(path.extname(f).toLowerCase()))

    if (targetFiles.length === 0) {
      console.log('clash-rules 目录下没有找到任何 .txt 或 .yaml 文件')
      return
    }

    targetFiles.forEach((file) => convertFile(path.join(clashRulesDir, file)))
  })
}
