const { withXcodeProject } = require('@expo/config-plugins');

const withIosDeploymentTarget = (config, { deploymentTarget = '15.1' } = {}) => {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;
    
    // Update all build configurations
    const buildConfigurations = project.pbxXCBuildConfigurationSection();
    for (const key in buildConfigurations) {
      const buildConfig = buildConfigurations[key];
      if (buildConfig.buildSettings) {
        buildConfig.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = deploymentTarget;
      }
    }
    
    return config;
  });
};

module.exports = withIosDeploymentTarget;