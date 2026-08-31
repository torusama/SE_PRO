// PA04 official automated test case
import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS
import pa04.ApiTestHelper

String token = ApiTestHelper.login('admin@cemetery.vn')
def page1Response = ApiTestHelper.send('GET', '/admin/plots?search=A-01&status=available&zoneId=1&page=1&pageSize=2&sortBy=id&sortOrder=asc', null, token)
WS.verifyResponseStatusCode(page1Response, 200)
def page1 = ApiTestHelper.json(page1Response)
assert page1.success == true
assert page1.data.page == 1
assert page1.data.pageSize == 2
assert page1.data.total >= 3
assert page1.data.totalPages >= 2
assert page1.data.items.size() == 2
assert page1.data.items.every { it.plotCode.contains('A-01') && it.status == 'available' && it.zoneId == 1 }

def page2Response = ApiTestHelper.send('GET', '/admin/plots?search=A-01&status=available&zoneId=1&page=2&pageSize=2&sortBy=id&sortOrder=asc', null, token)
WS.verifyResponseStatusCode(page2Response, 200)
def page2 = ApiTestHelper.json(page2Response)
assert page2.data.page == 2
assert page2.data.items.size() >= 1
assert page1.data.items*.id.intersect(page2.data.items*.id).isEmpty()
println("TC-PLOT-02 PASS: total=${page1.data.total}, page1=${page1.data.items*.plotCode}, page2=${page2.data.items*.plotCode}")
