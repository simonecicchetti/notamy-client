module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@screens': './src/screens',
            '@services': './src/services',
            '@store': './src/store',
            '@utils': './src/utils',
            '@types': './src/types',
            '@config': './src/config',
            '@api': './src/api'
          }
        }
      ],
      'react-native-reanimated/plugin'
    ]
  };
};