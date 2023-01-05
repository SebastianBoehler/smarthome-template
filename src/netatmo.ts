export default class Netatmo {
    redirect_uri: string
    access_token?: string
    refresh_token?: string
    expiresIn?: number

    constructor(PORT: string | number) {
        const host = process.env.HOST || 'localhost'
        this.redirect_uri = `http://${host}:${PORT}/netatmo_callback`
    }

    getOAuthUrl() {
        return `https://api.netatmo.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${encodeURIComponent(this.redirect_uri)}&scope=read_homecoach&state=123456`
    }

    async getAccessToken(code: string, grant_type = 'authorization_code') {
        const response = await fetch('https://api.netatmo.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `grant_type=${grant_type}&client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&code=${code}&redirect_uri=${this.redirect_uri}`,
        })
        const data = await response.json()

        if (response.status === 200) {
            this.access_token = data.access_token
            this.refresh_token = data.refresh_token
            this.expiresIn = new Date().getTime() + data.expires_in * 1000
            return true
        }

        return false
    }

    async refreshToken() {
        const response = await fetch('https://api.netatmo.com/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `grant_type=refresh_token&client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&refresh_token=${this.refresh_token}`,
        })
        const data = await response.json()

        if (response.status === 200) {
            this.access_token = data.access_token
            this.refresh_token = data.refresh_token
            this.expiresIn = new Date().getTime() + data.expires_in * 1000
            return true
        }

        return false
    }

    async gethomecoachsdata() {
        const mac = process.env.MAC_ADDRESS
        const response = await fetch(`https://api.netatmo.com/api/gethomecoachsdata?device_id=${mac}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.access_token}`,
            },
        })

        const data: coachsdata = await response.json()
        return data.status === 'ok' ? data.body : null
    }

    async checkTokenExpiration() {
        const now = new Date()
        now.setSeconds(now.getSeconds() - 30)
        if (this.expiresIn && this.expiresIn < now.getTime()) {
            console.log(`netatmo token expired, refreshing...`)
            return this.refreshToken()
        }
    }
}

type coachsdata = {
    status: string
    time_server: number
    time_exec: number
    body: {
        devices: [
            {
                _id: string //mac address
                station_name: string
                date_setup: number
                last_setup: number
                type: string
                last_status_store: number
                firmware: number
                wifi_status: number
                reachable: boolean
                co2_calibrating: boolean
                data_type: string[]
                place: {
                    altitude: number
                    city: string
                    country: string
                    timezone: string
                    location: [number, number]
                }
                dashboard_data: {
                    time_utc: number
                    Temperature: number
                    CO2: number
                    Humidity: number
                    Noise: number
                    Pressure: number
                    AbsolutePressure: number
                    health_idx: number
                }
            }
        ]
        user: {
            mail: string
            administrative: {
                lang: string
                reg_locale: string
                country: string
                unit: number
                windunit: number
                pressureunit: number
                feel_like_algo: number
            }
        }
    }
}