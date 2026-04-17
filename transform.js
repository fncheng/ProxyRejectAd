const fs = require('node:fs')
const path = require('node:path')

const clashRulesDir = path.join(__dirname, 'clash-rules')
const quanxRulesDir = path.join(__dirname, 'quanx-rules')

// Clash 规则类型 -> Quantumult X 规则类型映射
const RULE_TYPE_MAP = {
  'DOMAIN-SUFFIX': 'host-suffix',
  'DOMAIN-KEYWORD': 'host-keyword',
  'DOMAIN': 'host',
  'IP-CIDR': 'ip-cidr',
  'IP-CIDR6': 'ip6-cidr',
}

/**
 * 将 txt 格式的域名列表转换为 Quantumult X 规则行
 */
function convertTxtLines(data) {
  return data
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'))
    .map((domain) => {
      const normalizedDomain = domain.startsWith('*.') || domain.startsWith('+.') ? domain.substring(2) : domain
      const ruleType = normalizedDomain.includes('.') ? 'host-suffix' : 'host-keyword'
      return `${ruleType},${normalizedDomain},reject`
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
  const ext = path.extname(inputFile).toLowerCase()
  const inputFileNameWithoutExt = path.parse(path.basename(inputFile)).name
  const outputFilePath = path.join(quanxRulesDir, `${inputFileNameWithoutExt}.list`)

  fs.readFile(inputFile, 'utf8', (err, data) => {
    if (err) {
      console.error(`读取输入文件失败: ${inputFile}`, err)
      return
    }

    const rules = ext === '.yaml' ? convertYamlLines(data) : convertTxtLines(data)
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
