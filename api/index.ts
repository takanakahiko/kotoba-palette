import Vibrant from 'node-vibrant'
import express from 'express'
import ImageSearchAPIClient from 'azure-cognitiveservices-imagesearch'
import { CognitiveServicesCredentials } from 'ms-rest-azure'
import cors from 'cors'
import AWS from 'aws-sdk'
import multer from 'multer'

const app = express()

app.use(cors());
app.use(express.urlencoded({ extended: false }));

const credentials = new CognitiveServicesCredentials(process.env.API_KEY!);
const imageSearchApiClient = new ImageSearchAPIClient(credentials);

app.get('/getColors', async (req, res) =>{
  try {
    const imageResults = await imageSearchApiClient.imagesOperations.search(req.query.word);
    if(imageResults == null || imageResults.value.length == 0) throw Error('image not found')
    const pureImages = imageResults.value.filter(img => img.encodingFormat === 'jpeg' || img.encodingFormat === 'png')
    if(!pureImages[0].contentUrl) throw Error('image not found')
    for(let i = 0; i < 5; i++ ){
      const contentUrl = pureImages[i].contentUrl
      if(!contentUrl) throw Error('image not found')
      try {
        const palette = await Vibrant.from(contentUrl).getPalette()
        res.json(palette)
        break;
      } catch (error2) {
        console.log(`${i} : fetch error`)
        console.log(error2.toString())
        if(i==4) throw error2
      }
    }
  } catch (error) {
    console.log(error.toString())
    res.status(500)
    res.json({error: error.toString()})
  }
})

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/saveOgpImage', upload.single('image'), async (req, res) =>{
  try {
    const objectKey = Date.now().toString()
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: objectKey,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: "public-read"
    }
    const ret = await s3.upload(params).promise();
    res.json({id:objectKey})
  } catch (error) {
    console.log(error.toString())
    res.status(500)
    res.json({error: error.toString()})
  }
})

app.get('/ogpImage', async (req, res) =>{
  try {
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: req.query.id
    }
    const ret = await s3.getObject(params).promise();
    res.contentType(ret.ContentType!);
    res.status(200).send(ret.Body);
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
