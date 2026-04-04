const fs = require('fs');
const path = require('path');

// 除外する不要なフォルダ
const IGNORE = ['node_modules', '.next', '.git', 'dist', '.vercel'];

function printTree(dir, depth = 0, prefix = '') {
  // ★ ここを 3 から 4 に変更しました（4階層目まで取得）
  if (depth >= 4) return; 

  let files;
  try {
    files = fs.readdirSync(dir).filter(f => !IGNORE.includes(f));
  } catch (err) {
    return;
  }

  // フォルダを上に、ファイルを下に並び替え
  files.sort((a, b) => {
    const isDirA = fs.statSync(path.join(dir, a)).isDirectory();
    const isDirB = fs.statSync(path.join(dir, b)).isDirectory();
    if (isDirA && !isDirB) return -1;
    if (!isDirA && isDirB) return 1;
    return a.localeCompare(b);
  });

  files.forEach((file, index) => {
    const isLast = index === files.length - 1;
    console.log(prefix + (isLast ? '└── ' : '├── ') + file);
    
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      printTree(fullPath, depth + 1, prefix + (isLast ? '    ' : '│   '));
    }
  });
}

console.log('📁 Project Structure:');
printTree('./');