export default function (req, res, next) {
  if(req.host == 'kotoba-palette.herokuapp.com'){
    res.writeHead(301, { Location: `https://kotoba-palette.takanakahiko.me${req.originalUrl}` })
    res.end()
  }
  next()
}
