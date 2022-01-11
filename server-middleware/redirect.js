export default function (req, res, next) {
  if(req.get('host') == 'kotoba-palette.herokuapp.com'){
    const url = new URL(`https://kotoba-palette.takanakahiko.me${req.originalUrl}`)
    res.writeHead(301, { Location: redirect.to })
    res.end()
  }
  next()
}
