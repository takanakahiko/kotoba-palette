import Vibrant from 'node-vibrant'
import express from 'express'
const ImageSearchAPIClient = require('azure-cognitiveservices-imagesearch');
const CognitiveServicesCredentials = require('ms-rest-azure').CognitiveServicesCredentials;

const credentials = new CognitiveServicesCredentials(process.env.API_KEY);
const imageSearchApiClient = new ImageSearchAPIClient(credentials);

const app = express()

app.get('/', async (req, res) =>{
  try {
    const imageResults = await imageSearchApiClient.imagesOperations.search(req.query.word);
    if(imageResults == null || imageResults.value.length == 0) throw Error('image not found')
    const pureImages = imageResults.value.filter(img => img.encodingFormat === 'jpeg' || img.encodingFormat === 'png')
    const palette = await Vibrant.from(pureImages[0].contentUrl).getPalette()
    res.json(palette)
  } catch (error) {
    console.log(error.toString())
    res.status(500)
    res.json({error: error.toString()})
  }
})

module.exports = {
  path: '/api',
  handler: app,
}
