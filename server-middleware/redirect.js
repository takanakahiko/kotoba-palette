export default function (req, res, next) {
  if(req.headers.host == 'kotoba-palette.herokuapp.com'){
    const url = new URL(req.originalUrl, 'https://kotoba-palette.takanakahiko.me')
    res.writeHead(301, { Location: url })
    return res.end()
  }
  next()
}
