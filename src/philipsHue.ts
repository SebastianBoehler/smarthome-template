export default class PhilipsHue {
    redirect_uri: string
    colors: { [key: string]: [number, number] }
    access_token?: string
    refresh_token?: string
    expires_in?: number
    username?: string
    naturalLightScene?: smart_scene

    constructor(PORT: string | number) {
        this.colors = {
            red: [0.75, 0.27],
            orange: [0.6, 0.39],
            green: [0.3, 0.6],
        }
        const host = process.env.HOST || 'localhost'
        this.redirect_uri = `http://${host}:${PORT}/philipsHue_callback`
    }

    getOAuthUrl() {
        return `https://api.meethue.com/v2/oauth2/authorize?client_id=${process.env.HUE_ID}&redirect_uri=${encodeURIComponent(this.redirect_uri)}&response_type=code&state=123456`
    }

    async getAccessToken(code: string, grant_type = 'authorization_code') {
        console.log('token', code)
        const response = await fetch('https://api.meethue.com/v2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${process.env.HUE_ID}:${process.env.HUE_SECRET}`).toString('base64')}`,

            },
            body: `grant_type=${grant_type}&code=${code}`,
        })
        const data = await response.json()

        if (response.status === 200) {
            this.access_token = data.access_token
            this.refresh_token = data.refresh_token
            this.expires_in = new Date().getTime() + data.expires_in * 1000
            return true
        }

        return false
    }

    async refreshToken() {
        const resp = await fetch('https://api.meethue.com/v2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${Buffer.from(`${process.env.HUE_ID}:${process.env.HUE_SECRET}`).toString('base64')}`,
            },
            body: `grant_type=refresh_token&refresh_token=${this.refresh_token}`,
        })
        const data = await resp.json()

        if (resp.status === 200) {
            this.access_token = data.access_token
            this.refresh_token = data.refresh_token
            this.expires_in = new Date().getTime() + data.expires_in * 1000
            return true
        }

        return false
    }

    async createWhitelistUser() {
        await fetch(`https://api.meethue.com/route/api/0/config`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                linkbutton: true,
            })
        })

        const resp = await fetch(`https://api.meethue.com/route/api/`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                devicetype: 'sebastians hue app',
            })
        })
        const data = await resp.json()
        this.username = data[0].success.username
    }

    async setLightState(id: string | number, state: Record<string, any>) {
        if (!this.username) await this.createWhitelistUser()
        const response = await fetch(`https://api.meethue.com/route/api/${this.username}/lights/${id}/state`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(state),
        })

        console.log('set light state', id, response.status, response.statusText)

        const data: Record<string, light> = await response.json()
        return data
    }

    async checkTokenExpiration() {
        const now = new Date()
        now.setSeconds(now.getSeconds() - 30)
        if (this.expires_in && this.expires_in < now.getTime()) {
            console.log(`philips hue token expired, refreshing...`)
            return this.refreshToken()
        }
    }

    async getGroupsV2() {
        if (!this.username) await this.createWhitelistUser()
        const resp = await fetch(`https://api.meethue.com/route/clip/v2/resource/grouped_light`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'hue-application-key': this.username!,
            }
        })

        const data = await resp.json()
        return data
    }

    async setGroupState(id: string | number, state: Record<string, any>) {
        if (!this.username) await this.createWhitelistUser()
        const response = await fetch(`https://api.meethue.com/route/api/${this.username}/groups/${id}/action`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(state),
        })

        console.log('set group state', id, response.status, response.statusText)

        const data = await response.json()
        return data
    }

    async getScenesV2() {
        if (!this.username) await this.createWhitelistUser()
        const resp = await fetch(`https://api.meethue.com/route/clip/v2/resource/scene`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'hue-application-key': this.username!,
            },
        })

        const data: {
            errors: any[]
            data: scene[]
        } = await resp.json()
        return data.data
    }

    async getSceneDetailsV2(id: string | number) {
        if (!this.username) await this.createWhitelistUser()
        const resp = await fetch(`https://api.meethue.com/route/clip/v2/resource/scene/${id}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'hue-application-key': this.username!,
            }
        })

        const data: {
            errors: any[]
            data: scene
        } = await resp.json()
        return data.data
    }

    async getSmartScenesV2() {
        if (!this.username) await this.createWhitelistUser()
        const resp = await fetch(`https://api.meethue.com/route/clip/v2/resource/smart_scene`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'hue-application-key': this.username!,
            }
        })

        const data: {
            errors: any[]
            data: smart_scene[]
        } = await resp.json()
        return data.data
    }

    async activateSceneV2(id: string) {
        const resp = await fetch(`https://api.meethue.com/route/clip/v2/resource/scene/${id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'hue-application-key': this.username!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                auto_dynamic: true,
                recall: {
                    action: 'active',
                    status: 'active'
                }
            })
        })

       return await resp.json()
    }

    async activateSmartSceneV2(id: string) {
        if (!this.username) await this.createWhitelistUser()
        const resp = await fetch(`https://api.meethue.com/route/clip/v2/resource/smart_scene/${id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${this.access_token}`,
                'hue-application-key': this.username!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                auto_dynamic: true,
                recall: {
                    action: 'activate',
                },
            })
        })

        return resp.status === 200
    }

    async loadNaturalLightScene() {
        const smart_scene = await this.getSmartScenesV2()
        const naturalLight = smart_scene.find(s => s.metadata.name === 'Natürliches Licht')
        if (naturalLight) {
            this.naturalLightScene = naturalLight
            console.log('loaded scene', naturalLight.metadata.name)
        }
    }

    async showAlert(color: 'red' | 'orange' | 'green' = 'red') {
        if (!this.naturalLightScene) await this.loadNaturalLightScene()
        const naturalLight = this.naturalLightScene
        if (!naturalLight) {
            console.error('[alert] no natural light scene found')
            return
        }


        console.log('showAlert', color, new Date().toString())
        await this.setGroupState('1', { on: true, bri: 255, xy: this.colors[color] })

        await sleep(1000 * 15)

        const activate = await this.activateSmartSceneV2(naturalLight.id)
        if (!activate) {
            console.warn('[alert] failed to activate natural light scene')
            await sleep(1000 * 5)
            await this.activateSmartSceneV2(naturalLight.id)
        }
    }


}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

//get smart scene
//property weektimeslots says when to play which scene
//use this scene id to activate it at time

type smart_scene = {
    id: string
    type: string
    metadata: {
        name: string
        image: {
            rid: string
            rtype: string
        }
    }
    group?: {
        rid: string
        rtype: string
    }
    week_timeslots: {
        timeslots: {
            start_time: {
                kind: string
                time: {
                    hour: number
                    minute: number
                    second: number
                }
            }
            target: {
                rid: string
                rtype: string
            }
        }[]
    }[]
    active_timeslot?: {
        timeslot_id: number
        weekday: string
    }
    state?: string
}

type scene = {
    id: string
    id_v1: string
    actions: {
        target: {
            rid: string
            rtype: string
        }
        action: Record<string, any>
    }[]
    metadata: {
        name: string
        image: {
            rid: string
            rtype: string
        }
    }
}

type light = {
    state: {
        on: boolean
        bri: number
        hue: number
        sat: number
        effect: string
        xy: [number, number]
        ct: number
        alert: string
        colormode: string
        mode: string
        reachable: boolean
    }
    swupdate: {
        state: string
        lastinstall: string
    }
    type: string
    name: string
    modelid: string
    manufacturername: string
    productname: string
    capabilities: {
        certified: boolean
        control: {
            mindimlevel: number
            maxlumen: number
            colorgamuttype: string
            colorgamut: [number, number][]
            ct: {
                min: number
                max: number
            }
        }
        streaming: {
            renderer: boolean
            proxy: boolean
        }
    }
    config: {
        archetype: string
        function: string
        direction: string
        startup: {
            mode: string
            configured: boolean
        }
    }
    uniqueid: string
    swversion: string
    swconfigid: string
    productid: string
}