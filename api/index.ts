import Vibrant from 'node-vibrant'
import express from 'express'
import ImageSearchAPIClient from 'azure-cognitiveservices-imagesearch'
import { CognitiveServicesCredentials } from 'ms-rest-azure'
import cors from 'cors'
import AWS from 'aws-sdk'
import multer from 'multer'
import gis from 'g-i-s'

const app = express()

app.use(cors());
app.use(express.urlencoded({ extended: false }));

// const credentials = new CognitiveServicesCredentials(process.env.API_KEY!);
// const imageSearchApinClient = new ImageSearchAPIClient(credentials);

interface FetchImageResult {url: string, width: number, height: number}
const fetchImage = (word: string) => new Promise<FetchImageResult[]>((resolve, reject) => {
  gis(word, (error, results: FetchImageResult[]) => {
    if(error) reject(error)
    resolve(results)
  });
});

app.get('/getColors', async (req, res) =>{
  try {
    const imageResults = await fetchImage(req.query.word!.toString())
    if(imageResults == null || imageResults.length == 0) throw Error('image not found')
    for(const i in imageResults) {
      const contentUrl = imageResults[i].url
      console.log(contentUrl)
      if(!contentUrl.includes('.jpeg') && !contentUrl.includes('.jpg') && !contentUrl.includes('.png')){
        console.log(`${i} : image is not jpeg or jpg or png`)
        continue
      }
      try {
        const palette = await Vibrant.from(contentUrl).getPalette()
        res.json(palette)
        break;
      } catch (error2) {
        console.log(`${i} : fetch error`)
        console.log(error2.toString())
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
    res.json({id:"objectKey"})
  } catch (error) {
    console.log(error.toString())
    res.status(500)
    res.json({error: error.toString()})
  }
})

app.get('/ogpImage', async (req, res) =>{
  try {
    const params: AWS.S3.GetObjectRequest = {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: req.query.id!.toString(),
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
