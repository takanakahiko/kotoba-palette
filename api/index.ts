import GoogleImages from 'google-images'
import Vibrant from 'node-vibrant'
import express from 'express'

const app = express()

app.get('/', async (req, res) =>{
  try {
    const client = new GoogleImages(process.env.CSE_ID, process.env.API_KEY);
    const images = await client.search(req.query.word)
    const pureImages = images.filter(img => img.type === 'image/jpeg' || img.type === 'image/png')
    const palette = await Vibrant.from(pureImages[0].url).getPalette()
    res.json(palette)
  } catch (error) {
    res.status(500)
    res.json({error: error.toString()})
  }
})

module.exports = {
  path: '/api',
  handler: app,
}
