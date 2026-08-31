import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject

import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import groovy.json.JsonSlurper

def response = WS.sendRequest(
	findTestObject('API_Plots_GetPublicList')
)

// Verify HTTP status
WS.verifyResponseStatusCode(response, 200)

// Đọc JSON response
def json = new JsonSlurper().parseText(response.getResponseBodyContent())

// Verify cấu trúc và dữ liệu
assert json.success == true : 'success phải bằng true'
assert json.data instanceof List : 'data phải là danh sách'
assert json.data.size() > 0 : 'Danh sách lô đất không được rỗng'

// Verify các field chính của từng lô
json.data.each { plot ->
	assert plot.id != null : 'Thiếu id'
	assert plot.plotCode != null : 'Thiếu plotCode'
	assert plot.zoneName != null : 'Thiếu zoneName'
	assert plot.status != null : 'Thiếu status'
	assert plot.price != null : 'Thiếu price'
}

println("TC-PLOT-01: tìm thấy ${json.data.size()} lô đất")
println("Lô đầu tiên: id=${json.data[0].id}, plotCode=${json.data[0].plotCode}, status=${json.data[0].status}")