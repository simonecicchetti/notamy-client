const fs = require('fs');
const path = require('path');

console.log('Running post-install script to fix ReactCommon redefinition...');

// Percorsi corretti dei file problematici
const paths = [
  path.resolve(__dirname, '../ios/Pods/Headers/Public/React-RuntimeApple/React-RuntimeApple.modulemap'),
  path.resolve(__dirname, '../ios/Pods/Headers/Public/ReactCommon/ReactCommon.modulemap'),
  // Il percorso che stavi cercando prima (nel caso esista)
  path.resolve(__dirname, '../ios/Pods/Headers/Public/ReactCommon/React-RuntimeApple.modulemap')
];

paths.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      // Opzione 1: Rimuovi completamente il file (più sicuro)
      fs.unlinkSync(filePath);
      console.log(`Successfully removed: ${path.basename(filePath)}`);
      
      // Opzione 2: Se preferisci commentare invece di rimuovere
      // let fileContent = fs.readFileSync(filePath, 'utf-8');
      // const commentedContent = fileContent
      //   .split('\n')
      //   .map(line => `// ${line}`)
      //   .join('\n');
      // fs.writeFileSync(filePath, commentedContent, 'utf-8');
      // console.log(`Successfully commented out: ${path.basename(filePath)}`);
    } else {
      console.log(`File not found (this might be okay): ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`Error processing ${path.basename(filePath)}:`, error.message);
  }
});