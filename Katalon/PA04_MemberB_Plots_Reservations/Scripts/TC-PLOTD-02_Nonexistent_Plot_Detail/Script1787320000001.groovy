// PA04 official automated test case
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import pa04.ApiTestHelper

def response = ApiTestHelper.send('GET', '/plots/999999')
WS.verifyResponseStatusCode(response, 404)
def json = ApiTestHelper.json(response)
assert json.success == false
assert json.data == null
assert json.message == 'Plot not found'
assert json.error == 'NOT_FOUND'
println("TC-PLOTD-02 PASS: status=404, message=${json.message}")
