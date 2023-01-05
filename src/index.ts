import dotEnvextended from 'dotenv-extended'
dotEnvextended.load({
    errorOnMissing: true,
    schema: './.env.schema',
})
import express from 'express'
import netatmo from './netatmo'
import philipsHue from './philipsHue'
const app = express()
app.use(express.json())
const PORT = process.env.PORT || 3005

const myNetatmo = new netatmo(PORT)
const myPhilipsHue = new philipsHue(PORT)

app.get('/netatmo_callback', async (req, res) => {
    console.log(req.path)
    const { code } = req.query
    if (!code) return
    const success = await myNetatmo.getAccessToken(code.toString())
    res.send({
        success,
    })
});

app.get('/philipsHue_callback', async (req, res) => {
    console.log(req.path)
    const { code } = req.query
    if (!code) return
    const success = await myPhilipsHue.getAccessToken(code.toString())
    res.json({
        success,
    })
});

app.get('/ping', (req, res) => {
    res.send('pong')
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
    console.log(myNetatmo.getOAuthUrl())
    console.log(myPhilipsHue.getOAuthUrl())
});

setInterval(async () => {
    myNetatmo.checkTokenExpiration()
    myPhilipsHue.checkTokenExpiration()
}, 1000 * 15)

let lastAlert = 0
setInterval(async () => {
    const now = new Date()
    const hour = now.getHours()
    if (hour < 7 || hour > 22) return
    if (lastAlert > now.getTime() - 1000 * 60 * 5) return
    const data = await myNetatmo.gethomecoachsdata()
    if (!data) {
        console.error('no data from netatmo')
        return
    }
    const { CO2 } = data?.devices[0].dashboard_data
    console.log('CO2 level ppm:', CO2)

    if (lastAlert > now.getTime() - 1000 * 60 * 6.5 && CO2 < 800) {
        await myPhilipsHue.showAlert('green')
    }
    if (CO2 > 800 && CO2 < 1500) {
        lastAlert = new Date().getTime()
        await myPhilipsHue.showAlert('orange')
    }
    if (CO2 > 1500) {
        lastAlert = new Date().getTime()
        await myPhilipsHue.showAlert('red')
    }
}, 1000 * 60)