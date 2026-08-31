// PA04 official automated test case
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import pa04.ApiTestHelper

String token = ApiTestHelper.login('khachhang1@gmail.com')

def response = ApiTestHelper.send(
    'POST',
    '/reservations/multiple',
    [plotIds: [1, 13]],
    token
)

WS.verifyResponseStatusCode(response, 400)

def json = ApiTestHelper.json(response)

assert json.success == false
assert json.data == null
assert json.error == 'BAD_REQUEST'
assert json.message != null

def message = json.message.toLowerCase()
assert message.contains('adjacent') ||
       message.contains('liền kề') ||
       message.contains('kề nhau')

println("TC-RSV1-02 PASS: non-adjacent plots rejected, message=${json.message}")