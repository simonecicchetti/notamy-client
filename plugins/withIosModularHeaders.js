const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withIosModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(config.modRequest.projectRoot, 'ios', 'Podfile');
      let podfileContent = fs.readFileSync(podfilePath, 'utf8');
      
      const stringToAdd = "use_modular_headers!";
      const platformLine = /platform :ios, .*/;
      
      if (!podfileContent.includes(stringToAdd)) {
        podfileContent = podfileContent.replace(
          platformLine,
          `$&\n\n${stringToAdd}`
        );
        fs.writeFileSync(podfilePath, podfileContent, 'utf8');
      }
      
      return config;
    },
  ]);
};

module.exports = (config, _props) => config ? withIosModularHeaders(config) : config;