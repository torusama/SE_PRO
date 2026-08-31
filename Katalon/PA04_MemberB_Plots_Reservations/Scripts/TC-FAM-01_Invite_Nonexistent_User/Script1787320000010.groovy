// PA04 official automated test case
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import pa04.ApiTestHelper

String token = ApiTestHelper.login('khachhang1@gmail.com')

String missingEmail =
    "missing_${System.currentTimeMillis()}@example.com"

def response = ApiTestHelper.send(
    'POST',
    '/families/999999/invitations',
    [
        inviteeEmail: missingEmail
    ],
    token
)

WS.verifyResponseStatusCode(response, 404)

def json = ApiTestHelper.json(response)

assert json.success == false
assert json.data == null
assert json.error == 'NOT_FOUND'
assert json.message != null

def message = json.message.toString().toLowerCase()

assert message.contains('not found') ||
       message.contains('không tồn tại') ||
       message.contains('không tìm thấy')

println("TC-FAM-01 PASS: nonexistent user rejected, email=${missingEmail}, message=${json.message}")