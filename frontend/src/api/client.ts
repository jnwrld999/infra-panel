import axios from 'axios'

const client = axios.create({ baseURL: '/api', withCredentials: true })

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true
      try {
        await axios.post('/auth/refresh', {}, { withCredentials: true })
        return client(error.config)
      } catch {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default client
