import concurrent.futures
from datetime import datetime, timezone
from functools import lru_cache
from typing import List

import msgpack
from aiocache import cached
from brotli_asgi import BrotliMiddleware
from faker import Faker
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel
from zstd_asgi import ZstdMiddleware

app = FastAPI()


# Configurar CORS para permitir peticiones desde el frontend

app.add_middleware(

    CORSMiddleware,

    allow_origins=["http://localhost:5173"],  # Puerto por defecto de Vite

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


# Configurar GZip para comprimir respuestas

app.add_middleware(GZipMiddleware, minimum_size=1000)

# app.add_middleware(BrotliMiddleware, quality=11)

# app.add_middleware(ZstdMiddleware, level=22)


# Inicializar Faker con locale español

fake = Faker('es_ES')


# Modelo Pydantic para los datos

class User(BaseModel, frozen=True):

    id: int

    name: str

    email: str

    age: int

    city: str


class DataResponse(BaseModel, frozen=True):

    users: tuple[User, ...]

    total: int

    timestamp: str


# Datos mock
def create_fake_user(i: int) -> User:
    fake = Faker('es_ES')
    return User(
        id=i,
        name=fake.name(),
        email=fake.email(),
        age=fake.random_int(min=18, max=65),
        city=fake.city()
    )


@cached()
async def get_mock_data() -> DataResponse:
    print("GET USERS...")
    users = []
    total_users = 5000
    user_ids = range(1, total_users + 1)

    with concurrent.futures.ProcessPoolExecutor() as executor:
        users = list(executor.map(create_fake_user, user_ids))
    # for i in range(1, total_users):
    #     print(i)
    #     users.append(User(

    #         id=i,

    #         name=fake.name(),

    #         email=fake.email(),

    #         age=fake.random_int(min=18, max=65),

    #         city=fake.city()
    #     ))

    return DataResponse(

        users=tuple(users),

        total=total_users,

        timestamp=datetime.now(timezone.utc).isoformat()
    )


async def get_data_json(data: DataResponse):
    """Endpoint que retorna datos serializados en msgpack"""

    return data


@app.get("/data")
async def get_data(request: Request):

    accept_header = request.headers.get("accept", "")

    data = await get_mock_data()

    etag = str(hash(data))

    print(etag)

    if "application/x-msgpack" in accept_header:

        response = await get_data_msgpack(data)

    elif "application/x-protobuf" in accept_header:

        response = await get_data_protobuf(data)

    else:

        response = await get_data_json(data)

    # response.headers[""]

    if_none_match = request.headers.get("if-none-match")
    if_modified_since = request.headers.get("if-modified-since")

    if data.timestamp == if_modified_since or if_none_match == etag:
        return Response(status_code=304, headers={"Cache-Control": "private, max-age=300"})

    # Privado y fresco por 300 segundos (5 minutos)
    response.headers["Cache-Control"] = "private, max-age=30"
    response.headers["Last-Modified"] = data.timestamp
    response.headers["ETag"] = etag
    return response


async def get_data_msgpack(data: DataResponse):
    """Endpoint que retorna datos serializados en msgpack"""

    # data = get_mock_data()

    # Convertir el modelo Pydantic a dict y serializar con msgpack
    data_dict = data.model_dump()

    msgpack_data = msgpack.packb(data_dict)

    # Retornar con el content-type apropiado

    return Response(

        content=msgpack_data,

        media_type="application/x-msgpack"
    )


async def get_data_protobuf(data: DataResponse):
    """Endpoint que retorna datos serializados en protobuf"""

    try:

        import data_pb2

    except ImportError:

        return Response(

            content=b"Protobuf not compiled. Run: protoc --python_out=. data.proto",

            status_code=500
        )

    # data = get_mock_data()

    # Crear mensaje protobuf

    proto_response = data_pb2.DataResponse()
    proto_response.total = data.total
    proto_response.timestamp = data.timestamp

    for user in data.users:
        proto_user = proto_response.users.add()
        proto_user.id = user.id
        proto_user.name = user.name
        proto_user.email = user.email
        proto_user.age = user.age

        proto_user.city = user.city

    # Serializar a bytes

    protobuf_data = proto_response.SerializeToString()

    return Response(

        content=protobuf_data,

        media_type="application/x-protobuf"
    )


@app.get("/")
async def root():

    return {"message": "Backend FastAPI con MessagePack"}
