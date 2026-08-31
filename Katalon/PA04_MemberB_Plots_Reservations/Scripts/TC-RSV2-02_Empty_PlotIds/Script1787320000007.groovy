// PA04 official automated test case
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import pa04.ApiTestHelper

String token = ApiTestHelper.login('khachhang1@gmail.com')

def response = ApiTestHelper.send(
    'POST',
    '/reservations/multiple',
    [plotIds: []],
    token
)

WS.verifyResponseStatusCode(response, 400)

def json = ApiTestHelper.json(response)

assert json.success == false
assert json.data == null
assert json.error == 'BAD_REQUEST'
assert json.message != null

def message = json.message.toString().toLowerCase()

assert message.contains('plotids') ||
       message.contains('empty') ||
       message.contains('ít nhất') ||
       message.contains('không được để trống')

println("TC-RSV2-02 PASS: empty plotIds rejected, message=${json.message}")