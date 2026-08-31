import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject

import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import groovy.json.JsonSlurper

def response = WS.sendRequest(
	findTestObject('API_Plots_GetValidDetail')
)

// Verify HTTP status
WS.verifyResponseStatusCode(response, 200)

// Parse JSON
def json = new JsonSlurper().parseText(
	response.getResponseBodyContent()
)

// Verify response
assert json.success == true : 'success phải bằng true'
assert json.data != null : 'data không được null'
assert json.data.id == 1 : 'Plot ID trả về phải bằng 1'

// Verify các field chi tiết
assert json.data.plotCode != null : 'Thiếu plotCode'
assert json.data.zoneId != null : 'Thiếu zoneId'
assert json.data.zoneName != null : 'Thiếu zoneName'
assert json.data.rowCode != null : 'Thiếu rowCode'
assert json.data.plotNumber != null : 'Thiếu plotNumber'
assert json.data.status != null : 'Thiếu status'
assert json.data.price != null : 'Thiếu price'
assert json.data.area != null : 'Thiếu area'
assert json.data.direction != null : 'Thiếu direction'
assert json.data.plotType != null : 'Thiếu plotType'

println("TC-PLOTD-01 PASS")
println("Plot ID=${json.data.id}, code=${json.data.plotCode}, status=${json.data.status}")