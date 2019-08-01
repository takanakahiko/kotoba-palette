
export default {
  mode: 'universal',
  serverMiddleware: ['~/api','redirect-ssl'],
  head: {
    title: process.env.npm_package_name || '',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: '単語を色に変換すっぞ！！！！！！' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },
  loading: { color: '#fff' },
  modules: [
    '@nuxtjs/toast',
  ]
}
