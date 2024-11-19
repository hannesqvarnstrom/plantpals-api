module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    moduleNameMapper: {
        "@exmpl/(.*)": "<rootDir>/src/$1" // <----- change this if it fails to map correctly
    }
}