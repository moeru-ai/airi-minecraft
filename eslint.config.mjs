import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'import/order': [
      'error',
      {
        'groups': [
          ['type'], // types 最优先
          ['builtin', 'external'], // 然后是内置模块和外部包
          ['parent', 'sibling', 'index'], // 最后是内部引用
        ],
        'newlines-between': 'always',
      },
    ],
  },
})
