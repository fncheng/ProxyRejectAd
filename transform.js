const fs = require('node:fs')
const path = require('node:path')

const clashRulesDir = path.join(__dirname, 'clash-rules')
const quanxRulesDir = path.join(__dirname, 'quanx-rules')

/**
 * 将单个 txt 文件转换为 Quantumult X snippet 并写入 quanx-rules 目录
 */
function convertFile(inputFile) {
  const inputFileNameWithoutExt = path.parse(path.basename(inputFile)).name
  const outputFilePath = path.join(quanxRulesDir, `${inputFileNameWithoutExt}.snippet`)

  fs.readFile(inputFile, 'utf8', (err, data) => {
    if (err) {
      console.error(`读取输入文件失败: ${inputFile}`, err)
      return
    }

    const domains = data
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')
    const quantumultxRules = domains.map((domain) => {
      const normalizedDomain = domain.startsWith('*') ? domain.substring(2) : domain
      const ruleType = normalizedDomain.includes('.') ? 'host-suffix' : 'host-keyword'
      return `${ruleType},${normalizedDomain},reject`
    })

    const outputContent = quantumultxRules.join('\n')

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
  // 未指定文件，批量转换 clash-rules 下所有 .txt 文件
  fs.readdir(clashRulesDir, (err, files) => {
    if (err) {
      console.error(`读取 clash-rules 目录失败: ${clashRulesDir}`, err)
      process.exit(1)
    }

    const txtFiles = files.filter((f) => path.extname(f) === '.txt')

    if (txtFiles.length === 0) {
      console.log('clash-rules 目录下没有找到任何 .txt 文件')
      return
    }

    txtFiles.forEach((file) => convertFile(path.join(clashRulesDir, file)))
  })
}
