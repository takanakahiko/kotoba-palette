
export default {
  mode: 'universal',
  buildModules: ['@nuxt/typescript-build'],
  serverMiddleware: ['~/api','redirect-ssl'],
  head: {
    title: process.env.npm_package_name || '',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: 'あなたが好きなものは，どんな色をしてますか？' }
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
    ]
  },
  loading: {
    color: 'green',
    height: '10px',
    duration: 1000,
    continuous: true
  },
  modules: [
    '@nuxtjs/toast',
  ]
}
