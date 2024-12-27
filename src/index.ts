import makeServer from './utils/server'

export const Application = async () => {
    const app = await makeServer()
    app.listen(3000, () => console.log('running123'))
    return app // for use in tests?! or define an Application class perhaps. extend or override??
}

Application()
