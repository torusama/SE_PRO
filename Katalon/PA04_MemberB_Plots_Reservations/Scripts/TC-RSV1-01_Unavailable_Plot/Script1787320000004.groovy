// PA04 official automated test case
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import pa04.ApiTestHelper

String token = ApiTestHelper.login('khachhang1@gmail.com')

def response = ApiTestHelper.send(
    'POST',
    '/reservations',
    [plotIds: [36]],
    token
)

WS.verifyResponseStatusCode(response, 400)

def json = ApiTestHelper.json(response)

assert json.success == false
assert json.data == null
assert json.error == 'BAD_REQUEST'
assert json.message.toLowerCase().contains('trống')

println("TC-RSV1-01 PASS: plotId=36 rejected, message=${json.message}")