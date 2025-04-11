const fs = require('node:fs');
const path = require('node:path');

// 配置输入和输出文件路径
const inputFile = path.resolve(__dirname, './reject.txt'); // 你的 Clash 域名列表文件
const outputFile = path.join(__dirname, './qx_reject.list'); // 输出的 Quantumult X 规则文件

fs.readFile(inputFile, 'utf8', (err, data) => {
  if (err) {
    console.error('读取输入文件失败:', err);
    return;
  }

  const domains = data.trim().split('\n').map(line => line.trim()).filter(line => line !== '');
  const quantumultxRules = domains.map(domain => {
    // 处理通配符域名，转换为 host-suffix
    const normalizedDomain = domain.startsWith('*') ? domain.substring(2) : domain;
    return `host-suffix,${normalizedDomain},reject`;
  });

  const outputContent = quantumultxRules.join('\n');

  fs.writeFile(outputFile, outputContent, 'utf8', err => {
    if (err) {
      console.error('写入输出文件失败:', err);
      return;
    }
    console.log(`转换完成！Quantumult X 拒绝规则已保存到: ${outputFile}`);
  });
});