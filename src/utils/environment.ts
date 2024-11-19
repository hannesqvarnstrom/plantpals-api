import { configDotenv } from "dotenv"

class Environment {
    private envVars: Map<string, string | number>
    constructor() {
        this.setup()
    }

    public override(key: string, value: string | number): void {
        this.envVars.set(key, value)
    }

    public overrideBulk(vars: Record<string, string | number>): void {
        for (const [key, value] of Object.entries(vars)) {
            this.envVars.set(key, value)
        }
    }

    public restore(): void {
        this.setup()
    }

    private setup(): void {
        configDotenv()
        const env = process.env
        this.envVars = new Map()
        for (const [key, value] of Object.entries(env)) {
            if (!value) continue
            this.envVars.set(key, value)
        }
    }

    public get<B extends boolean = true>(key: string, required?: B) {
        const v = this.envVars.get(key)
        if (v === undefined)
            if (required !== undefined && required !== false)
                throw new Error(`A value for ${key} in environment variables is required.`)

        return v as B extends true ? EnvValue : EnvValue | undefined
    }

    public isDev() {
        return this.get('NODE_ENV') === 'development'
    }
}
const envVars = new Environment()

export default envVars

type EnvValue = string
