// PA04 official automated test case
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import pa04.ApiTestHelper

String token = ApiTestHelper.login('khachhang1@gmail.com')
String code = "TEST_FORBIDDEN_${System.currentTimeMillis()}"
def body = [plotCode: code, zoneId: 1, rowNumber: '99', columnNumber: '901', price: 1000000, area: 4, direction: 'Nam', plotType: 'single']
def response = ApiTestHelper.send('POST', '/admin/plots', body, token)
WS.verifyResponseStatusCode(response, 403)
def json = ApiTestHelper.json(response)
assert json.success == false
assert json.error == 'FORBIDDEN'

def list = ApiTestHelper.json(ApiTestHelper.send('GET', '/plots'))
assert !list.data.any { it.plotCode == code }
println("TC-PLOTM-01 PASS: status=403, plotCode=${code} was not created")
