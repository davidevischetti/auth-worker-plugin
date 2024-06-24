export async function newRequest(baseUrl, url, method, body)
{
    const myHeaders = new Headers()
    myHeaders.append("Accept", "application/json")
    const fetch_options = {
        credentials: "include",
        method: method,
        headers: myHeaders,
        mode: "cors",
        cache: "default",
    }
    if(method === 'POST'){
        const token = await newRequest(baseUrl,`${baseUrl}/authenticator/get-csrf-token`, 'GET')
            .then((response) =>  response.json())
        myHeaders.append("Content-Type", "application/json")
        myHeaders.append("X-CSRF-TOKEN", token.token)
        fetch_options.body = body
    }
    const req = new Request(url)
    return await fetch(req, fetch_options)
        // .then((response) => response.json())
        .then((data) => {
            return data
        })
}