import { decode } from '@msgpack/msgpack'
import axios from 'axios'
import * as protobuf from 'protobufjs'
import { useEffect, useState } from 'react'
import './App.css'

interface User {
  id: number
  name: string
  email: string
  age: number
  city: string
}

interface DataResponse {
  users: User[]
  total: number
  timestamp: string
}

function App() {
  const [data, setData] = useState<DataResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [ETag, setETag] = useState<string | null>(null)
  const [lastModified, setLastModified] = useState<string | null>(null);


  const fetchDataMsgPack = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get('http://localhost:8000/data', {
        headers: {
          Accept: 'application/x-msgpack',
          "If-None-Match": ETag ? ETag : '',
          'If-Modified-Since': lastModified ? lastModified : '',
        },
        responseType: 'arraybuffer'
      })

      const newETag = response.headers['etag'];
      const newLastModified = response.headers['last-modified'];

      if (newETag) setETag(newETag);
      if (newLastModified) setLastModified(newLastModified);

      // Deserializar los datos msgpack
      const decoded = decode(new Uint8Array(response.data)) as DataResponse
      setData(decoded)
    } catch (err) {
      setError('Error al obtener los datos. Asegúrate de que el backend esté ejecutándose.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchJsonData = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await axios.get<DataResponse>('http://localhost:8000/data', {
        headers: {
          Accept: 'application/json',
          "If-None-Match": ETag ? ETag : '',
          'If-Modified-Since': lastModified ? lastModified : '',
        },
      })
      const newETag = response.headers['etag'];
      const newLastModified = response.headers['last-modified'];

      if (newETag) setETag(newETag);
      if (newLastModified) setLastModified(newLastModified);
      setData(response.data)
    } catch (err) {
      setError('Error al obtener los datos. Asegúrate de que el backend esté ejecutándose.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchProtobufData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Cargar el schema protobuf
      // Usar una variable fuera del componente para cachear el schema
      let protoRoot: protobuf.Root | null = null

      if (!protoRoot) {
        protoRoot = await protobuf.load('/data.proto')
      }
      const root = protoRoot
      const DataResponse = root.lookupType('DataResponse')

      const response = await axios.get('http://localhost:8000/data', {
        headers: {
          Accept: 'application/x-protobuf',
          "If-None-Match": ETag ? ETag : '',
          'If-Modified-Since': lastModified ? lastModified : '',
        },
        responseType: 'arraybuffer'
      })
      const newETag = response.headers['etag'];
      const newLastModified = response.headers['last-modified'];

      if (newETag) setETag(newETag);
      if (newLastModified) setLastModified(newLastModified);

      // Deserializar los datos protobuf
      const message = DataResponse.decode(new Uint8Array(response.data))
      const decoded = DataResponse.toObject(message) as DataResponse
      setData(decoded)
    } catch (err) {
      setError('Error al obtener los datos protobuf. Asegúrate de que el backend esté ejecutándose.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDataMsgPack()
  }, [])

  return (
    <div className="app-container">
      <h1>Consulta de Datos</h1>

      <button onClick={fetchDataMsgPack} disabled={loading}>
        {loading ? 'Cargando...' : 'Actualizar Datos MessagePack'}
      </button>

      <button onClick={fetchJsonData} disabled={loading} style={{ marginLeft: '10px' }}>
        {loading ? 'Cargando...' : 'Actualizar Datos JSON'}
      </button>

      <button onClick={fetchProtobufData} disabled={loading} style={{ marginLeft: '10px' }}>
        {loading ? 'Cargando...' : 'Actualizar Datos Protobuf'}
      </button>

      {error && <div className="error">{error}</div>}

      {data && (
        <div className="data-info">
          <p>Total de usuarios: {data.total}</p>
          <p>Timestamp: {data.timestamp}</p>
        </div>
      )}

      {data && data.users && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Email</th>
                <th>Edad</th>
                <th>Ciudad</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((user) => (
                <tr key={user.id}>
                  <td>{user.id}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.age}</td>
                  <td>{user.city}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default App
