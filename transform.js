const fs = require('node:fs');
const path = require('node:path');

// 从命令行参数获取输入文件路径
const inputFile = process.argv[2];

if (!inputFile) {
  console.error('请在命令行中指定输入文件路径，例如: node transform.js reject.txt');
  process.exit(1); // 退出脚本，表示有错误发生
}

// 构建输出文件路径
const inputFileName = path.basename(inputFile); // 获取文件名 (例如: reject.txt)
const inputFileNameWithoutExt = path.parse(inputFileName).name; // 获取不带扩展名的文件名 (例如: reject)
const outputFileName = `qx_${inputFileNameWithoutExt}.list`;
const outputFilePath = path.join(__dirname, outputFileName);

fs.readFile(inputFile, 'utf8', (err, data) => {
  if (err) {
    console.error(`读取输入文件失败: ${inputFile}`, err);
    return;
  }

  const domains = data.trim().split('\n').map(line => line.trim()).filter(line => line !== '');
  const quantumultxRules = domains.map(domain => {
    const normalizedDomain = domain.startsWith('*') ? domain.substring(2) : domain;
    return `host-suffix,${normalizedDomain},reject`;
  });

  const outputContent = quantumultxRules.join('\n');

  fs.writeFile(outputFilePath, outputContent, 'utf8', err => {
    if (err) {
      console.error(`写入输出文件失败: ${outputFilePath}`, err);
      return;
    }
    console.log(`转换完成！Quantumult X 拒绝规则已保存到: ${outputFilePath}`);
  });
});